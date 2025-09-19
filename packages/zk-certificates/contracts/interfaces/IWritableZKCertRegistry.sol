// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {IReadableZkCertRegistry} from './IReadableZkCertRegistry.sol';

/**
 * @notice Enum to represent the operation of an action on the registry
 */
enum RegistryOperation {
    Add,
    Revoke
}

/**
 * @notice Enum to represent the state of a certificate. It flows from top to bottom.
 * @dev Revoked certs (identified by the hash) can not be issued again. Instead the guardian can create a new one with a different expiration and therefore hash.
 */
enum CertificateState {
    NonExistent,
    IssuanceQueued,
    Issued,
    RevocationQueued,
    Revoked
    // There is no state for expiration of the certificate itself because the registry does neither know nor need to know the certificate content.
}

/**
 * @notice Data structure to store the data needed to manage a zkCertificate.
 */
struct CertificateData {
    address guardian;
    uint256 queueIndex;
    CertificateState state;
}

/// @author Galactica dev team
/// @notice Interface for write functions of ZkCertificateRegistry
/// @dev This interface contains all state-changing functions used by guardians
interface IWritableZKCertRegistry is IReadableZkCertRegistry {
    event CertificateProcessed(
        bytes32 indexed zkCertificateLeafHash,
        address indexed Guardian,
        RegistryOperation operation,
        uint queueIndex,
        uint leafIndex
    );

    event OperationQueued(
        bytes32 indexed zkCertificateLeafHash,
        address indexed Guardian,
        RegistryOperation operation,
        uint queueIndex
    );

    /**
     * @notice Process the next operation from the queue to add or revoke a zkCertificate.
     * @dev This function may be called by anyone to process certificates added to the queue by guardians.
     * @param leafIndex - Leaf position of the zkCertificate in the Merkle tree.
     * @param zkCertificateHash - Hash of the zkCertificate record leaf.
     * @param merkleProof - Merkle proof of the zkCertificate record leaf being free.
     */
    function processNextOperation(
        uint256 leafIndex,
        bytes32 zkCertificateHash,
        bytes32[] memory merkleProof
    ) external;

    /** @notice Register an operation about a zkCertificate to the queue.
     * @param zkCertificateHash - Hash of the zkCertificate record leaf.
     * @param operation - Operation to add to the queue.
     */
    function addOperationToQueue(
        bytes32 zkCertificateHash,
        RegistryOperation operation
    ) external;

    // Block height at which the contract was initialized
    // You can use it to speed up finding all logs of the contract by starting from this block
    function initBlockHeight() external view returns (uint256);

    /**
     * @notice Get the data of a zkCertificate needed to process it.
     * @param zkCertificateHash - Hash of the zkCertificate record leaf.
     * @return The data of the zkCertificate needed to process it.
     */
    function zkCertificateProcessingData(
        bytes32 zkCertificateHash
    ) external view returns (CertificateData memory);
}
