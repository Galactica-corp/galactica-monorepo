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

    mapping(uint256 => address) public creatorOfIndex;

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
        recordRegistry.registerToQueue(
            zkKYCRecordHash
        );
        recordRegistry.addZkCertificate(
            leafIndex,
            zkKYCRecordHash,
            merkleProof
        );
        creatorOfIndex[leafIndex] = msg.sender;
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
            creatorOfIndex[leafIndex] == msg.sender,
            'KYCRecordRegistry (DevNet Test): not the corresponding KYC Center'
        );
        creatorOfIndex[leafIndex] = address(0);
        recordRegistry.registerToQueue(
            zkKYCRecordHash
        );
        recordRegistry.revokeZkCertificate(
            leafIndex,
            zkKYCRecordHash,
            merkleProof
        );
    }
}
