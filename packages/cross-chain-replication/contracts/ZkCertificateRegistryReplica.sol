// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {IReadableZkCertRegistry} from '@galactica-net/zk-certificates/contracts/interfaces/IReadableZkCertRegistry.sol';
import {IGuardianRegistry} from '@galactica-net/zk-certificates/contracts/interfaces/IGuardianRegistry.sol';

/**
 * @title ZkCertificateRegistryReplica
 * @author Galactica dev team
 * @notice Replica of ZkCertificateRegistry for cross-chain verification
 * @dev This contract stores replicated state from the source registry and provides
 * the same view functions for ZK proof verification.
 */
contract ZkCertificateRegistryReplica is IReadableZkCertRegistry {
  // State variables to be replicated
  bytes32[] public merkleRoots;
  uint256 public override merkleRootValidIndex;
  uint256 public override currentQueuePointer;

  // Immutable configuration (set at deployment)
  string public override description;
  uint256 public immutable override treeDepth;
  uint256 public immutable override treeSize;
  // Address of the guardian registry on the source chain
  IGuardianRegistry public immutable override guardianRegistry;

  // Mapping for quick merkle root lookups
  mapping(bytes32 => uint256) public override merkleRootIndex;

  // Authorization state
  address public authorizedUpdater; // The address authorized to call updateState, e.g. the bridge recipient contract
  bool public initialized;

  // Events
  event StateUpdated(
    bytes32[] newMerkleRoots,
    uint256 newMerkleRootValidIndex,
    uint256 newQueuePointer
  );
  event Initialized(address authorizedUpdater);

  modifier onlyAuthorizedUpdater() {
    require(
      msg.sender == authorizedUpdater,
      'ZkCertificateRegistryReplica: caller is not authorized updater'
    );
    _;
  }

  /**
   * @notice Constructor for the replica registry
   * @param _description Description of the certificate registry
   * @param _treeDepth Depth of the Merkle tree
   * @param _guardianRegistry Address of the guardian registry (for informational purposes)
   */
  constructor(
    string memory _description,
    uint256 _treeDepth,
    address _guardianRegistry
  ) {
    description = _description;
    treeDepth = _treeDepth;
    treeSize = 2 ** _treeDepth;
    guardianRegistry = IGuardianRegistry(_guardianRegistry);

    // Initialize with empty state
    merkleRootValidIndex = 1; // Same as source registry
    currentQueuePointer = 0;
  }

  /**
   * @notice Initializes the contract with the authorized updater address
   * @param _authorizedUpdater The address authorized to call updateState
   * @dev This function can only be called once
   */
  function initialize(address _authorizedUpdater) external {
    require(!initialized, 'ZkCertificateRegistryReplica: already initialized');
    require(
      _authorizedUpdater != address(0),
      'ZkCertificateRegistryReplica: authorized updater cannot be zero address'
    );

    authorizedUpdater = _authorizedUpdater;
    initialized = true;

    emit Initialized(_authorizedUpdater);
  }

  /**
   * @notice Returns the current merkle root (last one in the array)
   * @return The current merkle root
   */
  function merkleRoot() public view override returns (bytes32) {
    if (merkleRoots.length == 0) {
      return bytes32(0);
    }
    return merkleRoots[merkleRoots.length - 1];
  }

  /**
   * @notice Returns a slice of the merkle roots array starting from _startIndex
   * @param _startIndex The index to start returning roots from
   * @return Array of merkle roots from the start index
   */
  function getMerkleRoots(
    uint256 _startIndex
  ) public view override returns (bytes32[] memory) {
    require(_startIndex < merkleRoots.length, 'Start index out of bounds');

    uint256 length = merkleRoots.length - _startIndex;
    bytes32[] memory roots = new bytes32[](length);

    for (uint256 i = 0; i < length; i++) {
      roots[i] = merkleRoots[_startIndex + i];
    }

    return roots;
  }

  /**
   * @notice Verifies if a given merkle root is valid for proof verification
   * @param _merkleRoot The merkle root to verify
   * @return True if the merkle root is valid
   */
  function verifyMerkleRoot(
    bytes32 _merkleRoot
  ) public view override returns (bool) {
    uint256 _merkleRootIndex = merkleRootIndex[_merkleRoot];
    return _merkleRootIndex >= merkleRootValidIndex && _merkleRootIndex > 0;
  }

  /**
   * @notice Updates the registry state - only callable by authorized updater
   * @param newMerkleRoots Array of new merkle roots to append
   * @param newMerkleRootValidIndex New valid index for merkle roots
   * @param newQueuePointer New queue pointer value
   */
  function updateState(
    bytes32[] calldata newMerkleRoots,
    uint256 newMerkleRootValidIndex,
    uint256 newQueuePointer
  ) external onlyAuthorizedUpdater {
    require(newMerkleRoots.length > 0, 'Must provide at least one merkle root');
    require(
      newQueuePointer > currentQueuePointer,
      'The queue pointer must increase with every update'
    );
    require(
      newMerkleRootValidIndex >= merkleRootValidIndex,
      'The merkle root index may only increase'
    );

    // Append new merkle roots to the existing array
    for (uint256 i = 0; i < newMerkleRoots.length; i++) {
      merkleRoots.push(newMerkleRoots[i]);
      merkleRootIndex[newMerkleRoots[i]] = merkleRoots.length - 1;
    }

    // Update other state variables
    merkleRootValidIndex = newMerkleRootValidIndex;
    currentQueuePointer = newQueuePointer;

    emit StateUpdated(newMerkleRoots, newMerkleRootValidIndex, newQueuePointer);
  }
}
