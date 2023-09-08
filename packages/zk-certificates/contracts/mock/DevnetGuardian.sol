// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.7;
pragma abicoder v2;

import {KYCRecordRegistry} from "../KYCRecordRegistry.sol";

/**
 * @title DevnetGuardian is a simple KYC guardian that everyone can use to issue zkKYCs on Devnet
 * @author Galactica dev team
 * @notice Works as interface to the KYCRecordRegistry providing a simple way to issue zkKYCs while being authorized as a guardian
 */
contract DevnetGuardian {
    KYCRecordRegistry public recordRegistry;

    mapping(uint256 => address) public creatorOfIndex;

    constructor(address _recordRegistry) {
        recordRegistry = KYCRecordRegistry(_recordRegistry);
    }

    /**
     * @notice addZkKYCRecord issues a zkKYC record by adding it to the Merkle tree
     * @param leafIndex - leaf position of the zkKYC in the Merkle tree
     * @param zkKYCRecordHash - hash of the zkKYC record leaf
     * @param merkleProof - Merkle proof of the zkKYC record leaf being free
     */
    function addZkKYCRecord(
        uint256 leafIndex,
        bytes32 zkKYCRecordHash,
        bytes32[] memory merkleProof
    ) public {
        recordRegistry.addZkKYCRecord(leafIndex, zkKYCRecordHash, merkleProof);
        creatorOfIndex[leafIndex] = msg.sender;
    }

    /**
     * @notice revokeZkKYCRecord removes a previously issued zkKYC from the registry by setting the content of the merkle leaf to zero.
     * @param leafIndex - leaf position of the zkKYC in the Merkle tree
     * @param zkKYCRecordHash - hash of the zkKYC record leaf
     * @param merkleProof - Merkle proof of the zkKYC record being in the tree
     */
    function revokeZkKYCRecord(
        uint256 leafIndex,
        bytes32 zkKYCRecordHash,
        bytes32[] memory merkleProof
    ) public {
        // we check that address revoking the zkKYC is the creator to make this contract behave the same way as the original registry
        require(
            creatorOfIndex[leafIndex] == msg.sender,
            "KYCRecordRegistry (DevNet Test): not the corresponding KYC Center"
        );
        creatorOfIndex[leafIndex] = address(0);
        recordRegistry.revokeZkKYCRecord(
            leafIndex,
            zkKYCRecordHash,
            merkleProof
        );
    }
}
