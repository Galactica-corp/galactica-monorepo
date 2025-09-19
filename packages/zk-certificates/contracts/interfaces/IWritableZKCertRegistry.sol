// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {IReadableZkCertRegistry} from './IReadableZkCertRegistry.sol';

/// @author Galactica dev team
/// @notice Interface for write functions of ZkCertificateRegistry
/// @dev This interface contains all state-changing functions used by guardians
interface IWritableZKCertRegistry is IReadableZkCertRegistry {
    // Certificate management functions
    function addZkCertificate(
        uint256 leafIndex,
        bytes32 zkCertificateHash,
        bytes32[] memory merkleProof
    ) external;

    function revokeZkCertificate(
        uint256 leafIndex,
        bytes32 zkCertificateHash,
        bytes32[] memory merkleProof
    ) external;

    // Queue management functions
    function registerToQueue(bytes32 zkCertificateHash) external;

    function changeQueueExpirationTime(uint256 newTime) external;

    function queueExpirationTime() external view returns (uint256);

    function ZkCertificateToGuardian(
        bytes32 zkCertificateHash
    ) external view returns (address);

    function ZkCertificateHashToIndexInQueue(
        bytes32 zkCertificateHash
    ) external view returns (uint256);

    function ZkCertificateHashToQueueTime(
        bytes32 zkCertificateHash
    ) external view returns (uint256);

    function ZkCertificateHashToCommitedGuardian(
        bytes32 zkCertificateHash
    ) external view returns (address);

    // Queue validation functions
    function checkZkCertificateHashInQueue(
        bytes32 zkCertificateHash
    ) external view returns (bool);

    function getTimeParameters(
        bytes32 zkCertificateHash
    ) external view returns (uint, uint);

    // Block height at which the contract was initialized
    // You can use it to speed up finding all logs of the contract by starting from this block
    function initBlockHeight() external view returns (uint256);

    event zkCertificateAddition(
        bytes32 indexed zkCertificateLeafHash,
        address indexed Guardian,
        uint index
    );
    event zkCertificateRevocation(
        bytes32 indexed zkCertificateLeafHash,
        address indexed Guardian,
        uint index
    );
}
