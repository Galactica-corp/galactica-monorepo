// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {IGuardianRegistry} from './IGuardianRegistry.sol';

/// @author Galactica dev team
/// @notice Interface for read-only functions of ZkCertificateRegistry
/// @dev This interface contains all view functions needed by ZK verifiers and cross-chain replication
interface IReadableZkCertRegistry {
    // Merkle tree state functions
    function merkleRoot() external view returns (bytes32);

    function merkleRootsLength() external view returns (uint256);

    function merkleRootIndex(bytes32) external view returns (uint256);

    function merkleRootValidIndex() external view returns (uint256);

    function verifyMerkleRoot(bytes32) external view returns (bool);

    function description() external view returns (string memory);

    function treeDepth() external view returns (uint256);

    function treeSize() external view returns (uint256);

    // Merkle roots array functions
    function getMerkleRoots(
        uint256 _startIndex
    ) external view returns (bytes32[] memory);

    function getMerkleRoots(
        uint256 _startIndex,
        uint256 _endIndex
    ) external view returns (bytes32[] memory);

    // Queue state functions
    function currentQueuePointer() external view returns (uint256);

    // Registry references
    function guardianRegistry() external view returns (IGuardianRegistry);
}
