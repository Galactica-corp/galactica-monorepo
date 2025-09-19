// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {IMailbox} from '@hyperlane-xyz/core/contracts/interfaces/IMailbox.sol';
import {IMessageRecipient} from '@hyperlane-xyz/core/contracts/interfaces/IMessageRecipient.sol';
import {TypeCasts} from '@hyperlane-xyz/core/contracts/libs/TypeCasts.sol';
import {IZkCertificateRegistryReplica} from './interfaces/IZkCertificateRegistryReplica.sol';

/**
 * @title RegistryStateReceiver
 * @author Galactica dev team
 * @notice Contract responsible for receiving ZkCertificateRegistry state updates via Hyperlane
 * @dev This contract receives messages from the source chain and updates the replica registry
 * @dev We do not specify a custom Hyperlane ISM for this contract because the multisig default should be sufficient.
 */
contract RegistryStateReceiver is IMessageRecipient {
  // Immutable configuration
  IMailbox public immutable mailbox;
  IZkCertificateRegistryReplica public immutable replicaRegistry;
  uint32 public immutable originDomain;
  address public immutable senderAddress;

  // Events
  event StateReceived(
    uint32 origin,
    address sender,
    bytes32[] newMerkleRoots,
    bytes32 oldestValidMerkleRoot,
    uint256 newQueuePointer
  );

  /**
   * @notice Modifier to ensure only the Hyperlane mailbox can call functions
   */
  modifier onlyMailbox() {
    require(
      msg.sender == address(mailbox),
      'RegistryStateReceiver: caller is not the mailbox'
    );
    _;
  }

  /**
   * @notice Constructor for the RegistryStateReceiver
   * @param _mailbox Address of the Hyperlane mailbox contract
   * @param _replicaRegistry Address of the ZkCertificateRegistryReplica contract
   * @param _originDomain The Hyperlane domain ID of the source chain
   * @param _senderAddress Address of the RegistryStateSender on the source chain
   */
  constructor(
    address _mailbox,
    address _replicaRegistry,
    uint32 _originDomain,
    address _senderAddress
  ) {
    require(
      _mailbox != address(0),
      'RegistryStateReceiver: mailbox cannot be zero address'
    );
    require(
      _replicaRegistry != address(0),
      'RegistryStateReceiver: replica registry cannot be zero address'
    );
    require(
      _originDomain != 0,
      'RegistryStateReceiver: origin domain cannot be zero'
    );
    require(
      _senderAddress != address(0),
      'RegistryStateReceiver: sender address cannot be zero address'
    );

    mailbox = IMailbox(_mailbox);
    replicaRegistry = IZkCertificateRegistryReplica(_replicaRegistry);
    originDomain = _originDomain;
    senderAddress = _senderAddress;
  }

  /**
   * @notice Handles incoming messages from the Hyperlane Mailbox
   * @param _origin The domain ID of the source chain
   * @param _sender The address of the sender contract (as bytes32)
   * @param _message The encoded message body containing state updates
   * @dev This function authenticates the message source and triggers the state update on the replica
   */
  function handle(
    uint32 _origin,
    bytes32 _sender,
    bytes calldata _message
  ) external payable onlyMailbox {
    // Security check: Verify the message comes from the expected origin domain
    require(
      _origin == originDomain,
      'RegistryStateReceiver: invalid origin domain'
    );

    // Security check: Verify the message comes from the expected sender contract
    address actualSender = TypeCasts.bytes32ToAddress(_sender);
    require(
      actualSender == senderAddress,
      'RegistryStateReceiver: invalid sender address'
    );

    // Decode the message body to extract state update parameters
    (
      bytes32[] memory newMerkleRoots,
      bytes32 oldestValidMerkleRoot,
      uint256 newQueuePointer
    ) = abi.decode(_message, (bytes32[], bytes32, uint256));

    // Update the replica registry state
    replicaRegistry.updateState(
      newMerkleRoots,
      oldestValidMerkleRoot,
      newQueuePointer
    );

    // Emit event for monitoring and transparency
    emit StateReceived(
      _origin,
      actualSender,
      newMerkleRoots,
      oldestValidMerkleRoot,
      newQueuePointer
    );
  }
}
