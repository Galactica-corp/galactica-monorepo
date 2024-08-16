// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.7;
pragma abicoder v2;

import {ZkCertificateRegistry} from '../ZkCertificateRegistry.sol';

/**
 * @title DevnetGuardian is a simple KYC guardian that everyone can use to issue zkKYCs on Devnet
 * @author Galactica dev team
 * @notice Works as interface to the KYCRecordRegistry providing a simple way to issue zkKYCs while being authorized as a guardian
 */
contract DevnetGuardian {
    ZkCertificateRegistry public recordRegistry;

    mapping(bytes32 => address) public creatorOfLeaf;

    constructor(address _recordRegistry) {
        recordRegistry = ZkCertificateRegistry(_recordRegistry);
    }

    /**
     * @notice addZkCertificate issues a zkKYC record by adding it to the Merkle tree
     * @param leafIndex - leaf position of the zkKYC in the Merkle tree
     * @param zkKYCRecordHash - hash of the zkKYC record leaf
     * @param merkleProof - Merkle proof of the zkKYC record leaf being free
     */
    function addZkCertificate(
        uint256 leafIndex,
        bytes32 zkKYCRecordHash,
        bytes32[] memory merkleProof
    ) public {
        require(
            creatorOfLeaf[zkKYCRecordHash] == msg.sender,
            'KYCRecordRegistry (DevNet Test): not the corresponding KYC Center'
        );
        recordRegistry.addZkCertificate(
            leafIndex,
            zkKYCRecordHash,
            merkleProof
        );
    }

    /**
     * @notice addZkCertificate issues a zkCertificate record by adding it to the Merkle tree
     * @param leafIndex - leaf position of the zkCertificate in the Merkle tree
     * @param zkCertificateHash - hash of the zkCertificate record leaf
     * @param merkleProof - Merkle proof of the zkCertificate record leaf being free
     * @param idHash - Hash identifying the user. It is supposed to be the poseidon Hash of the name, birthday and citizenship.
     * @param saltHash - Hash of the salt, usually the commitment hash.
     * @param saltHash - Hash of the salt, usually the commitment hash.
     */
    function addZkCertificate(
        uint256 leafIndex,
        bytes32 zkCertificateHash,
        bytes32[] memory merkleProof,
        uint256 idHash,
        uint256 saltHash,
        uint256 expirationTime
    ) public {
        require(
            creatorOfLeaf[zkKYCRecordHash] == msg.sender,
            'KYCRecordRegistry (DevNet Test): not the corresponding KYC Center'
        );
        recordRegistry.addZkCertificate(
            leafIndex,
            zkKYCRecordHash,
            merkleProof,
            idHash,
            saltHash,
            expirationTime
        );
    }

    /**
     * @notice revokeZkCertificate removes a previously issued zkKYC from the registry by setting the content of the merkle leaf to zero.
     * @param leafIndex - leaf position of the zkKYC in the Merkle tree
     * @param zkKYCRecordHash - hash of the zkKYC record leaf
     * @param merkleProof - Merkle proof of the zkKYC record being in the tree
     */
    function revokeZkCertificate(
        uint256 leafIndex,
        bytes32 zkKYCRecordHash,
        bytes32[] memory merkleProof
    ) public {
        // we check that address revoking the zkKYC is the creator to make this contract behave the same way as the original registry
        require(
            creatorOfLeaf[zkKYCRecordHash] == msg.sender,
            'KYCRecordRegistry (DevNet Test): not the corresponding KYC Center'
        );
        creatorOfLeaf[zkKYCRecordHash] = address(0);
        recordRegistry.revokeZkCertificate(
            leafIndex,
            zkKYCRecordHash,
            merkleProof
        );
    }

    /**
     * @notice return the current merkle root which is the last one in the merkleRoots array
     */
    function merkleRoot() public view returns (bytes32) {
        return recordRegistry.merkleRoot();
    }

    /**
     * @notice return the whole merkle root array
     */
    function getMerkleRoots() public view returns (bytes32[] memory) {
        return recordRegistry.getMerkleRoots();
    }

    /** @notice Register a zkCertificate to the queue
     * @param zkCertificateHash - hash of the zkCertificate record leaf
     */
    function registerToQueue(bytes32 zkCertificateHash) public {
        creatorOfLeaf[zkCertificateHash] = msg.sender;
        recordRegistry.registerToQueue(zkCertificateHash);
    }

    function checkZkCertificateHashInQueue(
        bytes32 zkCertificateHash
    ) public view returns (bool) {
        return recordRegistry.checkZkCertificateHashInQueue(zkCertificateHash);
    }

    // function to return the time parameters of the period where one is allowed to add ZkCertificate
    function getTimeParameters(
        bytes32 zkCertificateHash
    ) public view returns (uint, uint) {
        return recordRegistry.getTimeParameters(zkCertificateHash);
    }
}
