// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {IMailbox} from '@hyperlane-xyz/core/contracts/interfaces/IMailbox.sol';
import {TypeCasts} from '@hyperlane-xyz/core/contracts/libs/TypeCasts.sol';
import {IReadableZkCertRegistry} from '@galactica-net/zk-certificates/contracts/interfaces/IReadableZkCertRegistry.sol';

/**
 * @title RegistryStateSender
 * @author Galactica dev team
 * @notice Contract responsible for sending ZkCertificateRegistry state updates via Hyperlane
 * @dev This contract reads state from the source registry and dispatches it to destination chains
 */
contract RegistryStateSender {
  // Immutable configuration
  IMailbox public immutable mailbox;
  IReadableZkCertRegistry public immutable registry;
  uint32 public immutable destinationDomain;

  // State tracking
  address public receiverAddress;
  bool public initialized;
  uint256 public lastSentMerkleRootsLength;
  uint256 public lastProcessedQueuePointer;
  uint256 public lastProcessedMerkleRootValidIndex;

  // Configuration
  uint256 public immutable maxMerkleRootsPerMessage;

  // Events
  event StateRelayed(
    bytes32[] newMerkleRoots,
    uint256 newSentMerkleRootsLength,
    uint256 currentMerkleRootValidIndex,
    bytes32 oldestValidMerkleRoot,
    uint256 newQueuePointer
  );

  /**
   * @notice Constructor for the RegistryStateSender
   * @param _mailbox Address of the Hyperlane mailbox contract
   * @param _registry Address of the source ZkCertificateRegistry
   * @param _destinationDomain The Hyperlane domain ID of the destination chain
   * @param _maxMerkleRootsPerMessage Maximum number of merkle roots to send in one message
   */
  constructor(
    address _mailbox,
    address _registry,
    uint32 _destinationDomain,
    uint256 _maxMerkleRootsPerMessage
  ) {
    require(
      _mailbox != address(0),
      'RegistryStateSender: mailbox cannot be zero address'
    );
    require(
      _registry != address(0),
      'RegistryStateSender: registry cannot be zero address'
    );
    require(
      _destinationDomain != 0,
      'RegistryStateSender: destination domain cannot be zero'
    );
    require(
      _maxMerkleRootsPerMessage > 0,
      'RegistryStateSender: max merkle roots per message must be greater than zero'
    );

    mailbox = IMailbox(_mailbox);
    registry = IReadableZkCertRegistry(_registry);
    destinationDomain = _destinationDomain;
    maxMerkleRootsPerMessage = _maxMerkleRootsPerMessage;

    // Initialize state tracking - start from the beginning
    lastProcessedQueuePointer = 0;
    lastSentMerkleRootsLength = 0;
    // MerkleRootValidIndex starts at the current state to consider all revocations from the beginning
    lastProcessedMerkleRootValidIndex = registry.merkleRootValidIndex();
  }

  /**
   * @notice One-time initialization function to set the receiver address
   * @param _receiverAddress Address of the RegistryStateReceiver on the destination chain
   * @dev Can only be called once, must be called before using relayState or quoteRelayFee
   */
  function initialize(address _receiverAddress) external {
    require(!initialized, 'RegistryStateSender: already initialized');
    require(
      _receiverAddress != address(0),
      'RegistryStateSender: receiver address cannot be zero'
    );

    receiverAddress = _receiverAddress;
    initialized = true;
  }

  /**
   * @notice Relays the latest state changes from the source registry to the destination chain
   * @dev Reads new merkle roots and state changes since the last relay, encodes them, and dispatches via Hyperlane
   *      Limits the number of merkle roots per message to avoid gas limit issues
   */
  function relayState() external payable {
    require(initialized, 'RegistryStateSender: not initialized');
    (
      bytes memory messageBody,
      uint256 newSentMerkleRootsLength,
      uint256 currentMerkleRootValidIndex,
      uint256 newQueuePointerToSend,
      bytes32[] memory newMerkleRoots,
      bytes32 oldestValidMerkleRoot
    ) = buildRelayStateMessage();

    // Check if there are new state changes to relay
    require(
      newQueuePointerToSend > lastProcessedQueuePointer ||
        currentMerkleRootValidIndex > lastProcessedMerkleRootValidIndex ||
        newSentMerkleRootsLength > lastSentMerkleRootsLength,
      'RegistryStateSender: no new state changes to relay'
    );

    // Dispatch the message via Hyperlane
    bytes32 recipientBytes32 = TypeCasts.addressToBytes32(receiverAddress);
    mailbox.dispatch{value: msg.value}(
      destinationDomain,
      recipientBytes32,
      messageBody
    );

    // Update tracking state
    lastProcessedMerkleRootValidIndex = currentMerkleRootValidIndex;
    lastSentMerkleRootsLength = newSentMerkleRootsLength;
    lastProcessedQueuePointer = newQueuePointerToSend;

    emit StateRelayed(
      newMerkleRoots,
      newSentMerkleRootsLength,
      currentMerkleRootValidIndex,
      oldestValidMerkleRoot,
      newQueuePointerToSend
    );
  }

  /**
   * @notice Estimates the fee required to relay state to the destination chain
   * @return The estimated fee in wei
   */
  function quoteRelayFee() external view returns (uint256) {
    require(initialized, 'RegistryStateSender: not initialized');
    (bytes memory messageBody, , , , , ) = buildRelayStateMessage();

    bytes32 recipientBytes32 = TypeCasts.addressToBytes32(receiverAddress);
    return
      mailbox.quoteDispatch(destinationDomain, recipientBytes32, messageBody);
  }

  function buildRelayStateMessage()
    internal
    view
    returns (
      bytes memory messageBody,
      uint256 newSentMerkleRootsLength,
      uint256 currentMerkleRootValidIndex,
      uint256 newQueuePointerToSend,
      bytes32[] memory newMerkleRoots,
      bytes32 oldestValidMerkleRoot
    )
  {
    // Read current state from the source registry
    uint256 currentQueuePointer = registry.currentQueuePointer();
    currentMerkleRootValidIndex = registry.merkleRootValidIndex();
    uint256 currentMerkleRootsLength = registry.merkleRootsLength();

    // Calculate how many new merkle roots we need to send
    uint256 newRootsCount = currentMerkleRootsLength -
      lastSentMerkleRootsLength;

    // Limit the number of roots per message
    uint256 rootsToSend = newRootsCount;
    if (rootsToSend > maxMerkleRootsPerMessage) {
      rootsToSend = maxMerkleRootsPerMessage;
    }

    // Get the merkle roots for this batch
    if (rootsToSend > 0) {
      // Calculate the range of merkle roots to send
      uint256 startIndex = lastSentMerkleRootsLength;
      uint256 endIndex = lastSentMerkleRootsLength + rootsToSend;

      // Get the merkle roots for this batch
      newMerkleRoots = registry.getMerkleRoots(startIndex, endIndex);
    } else {
      // No roots to send
      newMerkleRoots = new bytes32[](0);
    }

    // Calculate the new merkleRootValidIndex for this batch
    newSentMerkleRootsLength = lastSentMerkleRootsLength + rootsToSend;

    // Determine the queue pointer to send
    bool allRootsFit = (rootsToSend == newRootsCount);

    if (allRootsFit) {
      // All new roots fit in this message, send the current queue pointer
      newQueuePointerToSend = currentQueuePointer;
    } else {
      // Not all roots fit, only advance queue pointer by the number of roots sent
      newQueuePointerToSend = lastProcessedQueuePointer + rootsToSend;
    }

    // ABI encode the state update message
    // Instead of sending the merkleRootValidIndex directly, we send the actual merkle root
    // that the index points to. This makes the system robust against dropped messages.
    oldestValidMerkleRoot = registry.getMerkleRoots(
      currentMerkleRootValidIndex,
      currentMerkleRootValidIndex + 1
    )[0];
    messageBody = abi.encode(
      newMerkleRoots,
      oldestValidMerkleRoot,
      newQueuePointerToSend
    );
  }

  /**
   * @notice Gets the current state tracking information
   * @return _lastProcessedQueuePointer The last processed queue pointer
   * @return _lastProcessedMerkleRootValidIndex The last processed merkle root valid index
   * @return _lastSentMerkleRootsLength The last sent merkle roots length
   */
  function getLastProcessedState()
    external
    view
    returns (
      uint256 _lastProcessedQueuePointer,
      uint256 _lastProcessedMerkleRootValidIndex,
      uint256 _lastSentMerkleRootsLength
    )
  {
    return (
      lastProcessedQueuePointer,
      lastProcessedMerkleRootValidIndex,
      lastSentMerkleRootsLength
    );
  }

  /**
   * @notice Gets the current synchronization status with the source registry
   * @return merkleRootsLengthDiff The difference between current merkle roots array length and last sent length
   * @return hasNewRevocation True if there is a new revocation indicated by merkleRootValidIndex change
   * @return queuePointerDiff The difference between current queue pointer and last processed queue pointer
   */
  function getSyncStatus()
    external
    view
    returns (
      uint256 merkleRootsLengthDiff,
      bool hasNewRevocation,
      uint256 queuePointerDiff
    )
  {
    uint256 currentMerkleRootsLength = registry.merkleRootsLength();
    uint256 currentMerkleRootValidIndex = registry.merkleRootValidIndex();
    uint256 currentQueuePointer = registry.currentQueuePointer();

    merkleRootsLengthDiff =
      currentMerkleRootsLength -
      lastSentMerkleRootsLength;
    hasNewRevocation =
      currentMerkleRootValidIndex > lastProcessedMerkleRootValidIndex;
    queuePointerDiff = currentQueuePointer - lastProcessedQueuePointer;
  }
}
