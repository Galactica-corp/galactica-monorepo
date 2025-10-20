// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {IReadableZkCertRegistry} from '@galactica-net/zk-certificates/contracts/interfaces/IReadableZkCertRegistry.sol';

/// @author Galactica dev team
/// @notice Interface for ZkCertificateRegistryReplica with state update functionality
/// @dev Extends IReadableZkCertRegistry with cross-chain state update functions
interface IZkCertificateRegistryReplica is IReadableZkCertRegistry {
  /// @notice Initializes the contract with the authorized updater address
  /// @param _authorizedUpdater The address authorized to call updateState
  function initialize(address _authorizedUpdater) external;

  /// @notice Updates the registry state - only callable by authorized updater
  /// @param newMerkleRoots Array of new merkle roots to append
  /// @param validMerkleRoot The merkle root that marks the validity boundary (roots from this point onwards are valid)
  /// @param newQueuePointer New queue pointer value
  function updateState(
    bytes32[] calldata newMerkleRoots,
    bytes32 validMerkleRoot,
    uint256 newQueuePointer
  ) external;

  /// @notice Gets the authorized updater address
  function authorizedUpdater() external view returns (address);

  /// @notice Checks if the contract has been initialized
  function isInitialized() external view returns (bool);
}
