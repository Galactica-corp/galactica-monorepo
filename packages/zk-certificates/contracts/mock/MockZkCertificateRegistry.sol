// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {IZkCertificateRegistry} from '../interfaces/IZkCertificateRegistry.sol';
import {IGuardianRegistry} from '../interfaces/IGuardianRegistry.sol';

/// @author Galactica dev team
contract MockZkCertificateRegistry is IZkCertificateRegistry {
    bytes32 public constant MERKLE_ROOT_INITIAL_VALUE = bytes32(0);
    bytes32[] public merkleRoots = [MERKLE_ROOT_INITIAL_VALUE];
    uint256 public merkleRootValidIndex = 1;
    IGuardianRegistry public guardianRegistry;

    mapping(bytes32 => uint256) public merkleRootIndex;

    // Additional state variables for IReadableZkCertRegistry
    string public description = 'Mock ZK Certificate Registry';
    uint256 public immutable treeDepth = 32;
    uint256 public immutable treeSize = 2 ** 32;

    // Additional state variables for IWritableZKCertRegistry
    uint256 public queueExpirationTime = 120; // 2 minutes
    uint256 public currentQueuePointer;
    uint256 public initBlockHeight;

    mapping(bytes32 => address) public ZkCertificateToGuardian;
    mapping(bytes32 => uint256) public ZkCertificateHashToIndexInQueue;
    mapping(bytes32 => uint256) public ZkCertificateHashToQueueTime;
    mapping(bytes32 => address) public ZkCertificateHashToCommitedGuardian;
    bytes32[] public ZkCertificateQueue;

    function setMerkleRoot(bytes32 newMerkleRoot) public {
        merkleRoots.push(newMerkleRoot);
        merkleRootIndex[newMerkleRoot] = merkleRoots.length - 1;
    }

    function setMerkleRootValidIndex(uint256 newValue) public {
        merkleRootValidIndex = newValue;
    }

    function setGuardianRegistry(address _guardianRegistry) public {
        guardianRegistry = IGuardianRegistry(_guardianRegistry);
    }

    // Additional functions required by IReadableZkCertRegistry
    function merkleRoot() external view returns (bytes32) {
        return merkleRoots[merkleRoots.length - 1];
    }

    function verifyMerkleRoot(
        bytes32 _merkleRoot
    ) external view returns (bool) {
        uint _merkleRootIndex = merkleRootIndex[_merkleRoot];
        return _merkleRootIndex >= merkleRootValidIndex;
    }

    function getMerkleRoots(
        uint256 _startIndex
    ) external view returns (bytes32[] memory) {
        require(_startIndex < merkleRoots.length, 'Start index out of bounds');

        uint256 length = merkleRoots.length - _startIndex;
        bytes32[] memory roots = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            roots[i] = merkleRoots[_startIndex + i];
        }

        return roots;
    }

    // Additional functions required by IWritableZKCertRegistry
    function addZkCertificate(
        uint256 /*leafIndex*/,
        bytes32 /*zkCertificateHash*/,
        bytes32[] memory /*merkleProof*/
    ) external {
        // Mock implementation - do nothing
    }

    function revokeZkCertificate(
        uint256 /*leafIndex*/,
        bytes32 /*zkCertificateHash*/,
        bytes32[] memory /*merkleProof*/
    ) external {
        // Mock implementation - do nothing
    }

    function registerToQueue(bytes32 /*zkCertificateHash*/) external {
        // Mock implementation - do nothing
    }

    function changeQueueExpirationTime(uint256 newTime) external {
        queueExpirationTime = newTime;
    }

    function checkZkCertificateHashInQueue(
        bytes32 /*zkCertificateHash*/
    ) external pure returns (bool) {
        return false; // Mock implementation
    }

    function getTimeParameters(
        bytes32 /*zkCertificateHash*/
    ) external pure returns (uint, uint) {
        return (0, 0); // Mock implementation
    }

    /**
     * @notice Deprecated function to share interface with old contract version.
     */
    function _GuardianRegistry() public view returns (IGuardianRegistry) {
        return guardianRegistry;
    }
}
