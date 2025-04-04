// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.7;
pragma abicoder v2;

import {ZkCertificateRegistry} from './ZkCertificateRegistry.sol';
import {HumanIDSaltRegistry, SaltLockingZkCert} from './HumanIDSaltRegistry.sol';

/**
 * @title ZkCertificateRegistry
 * @author Galactica dev team
 * @notice A ZkCertificateRegistry for KYCs. It additionally makes sure that a unique salt is used for the humanID to make it unique and non-guessable.
 */
contract ZkKYCRegistry is ZkCertificateRegistry {
    HumanIDSaltRegistry public humanIDSaltRegistry;

    constructor(
        address GuardianRegistry_,
        uint256 treeDepth_,
        string memory description_
    )
        initializer
        ZkCertificateRegistry(GuardianRegistry_, treeDepth_, description_)
    {
        humanIDSaltRegistry = new HumanIDSaltRegistry(
            GuardianRegistry_,
            address(this)
        );
    }

    /**
     * @notice addZkCertificate issues a zkCertificate record by adding it to the Merkle tree
     */
    function addZkCertificate(
        uint256,
        bytes32,
        bytes32[] memory
    ) public pure override {
        revert(
            'ZkKYCRegistry: use addZkCertificate function with the parameters for the salt registry'
        );
    }

    /**
     * @notice addZkKYC issues a zkCertificate record by adding it to the Merkle tree
     * @param leafIndex - leaf position of the zkCertificate in the Merkle tree
     * @param zkCertificateHash - hash of the zkCertificate record leaf
     * @param merkleProof - Merkle proof of the zkCertificate record leaf being free
     * @param idHash - Hash identifying the user. It is supposed to be the poseidon Hash of the name, birthday and citizenship.
     * @param saltHash - Hash of the salt, usually the commitment hash.
     * @param expirationTime - Expiration time of the zkKYC.
     */
    function addZkKYC(
        uint256 leafIndex,
        bytes32 zkCertificateHash,
        bytes32[] memory merkleProof,
        uint256 idHash,
        uint256 saltHash,
        uint256 expirationTime
    ) public {
        humanIDSaltRegistry.onZkCertIssuance(
            SaltLockingZkCert({
                zkCertId: leafIndex,
                guardian: msg.sender,
                expirationTime: expirationTime,
                revoked: false
            }),
            idHash,
            saltHash
        );
        super.addZkCertificate(leafIndex, zkCertificateHash, merkleProof);
    }

    /**
     * @notice revokeZkCertificate removes a previously issued zkCertificate from the registry by setting the content of the merkle leaf to zero.
     * @param leafIndex - leaf position of the zkCertificate in the Merkle tree
     * @param zkCertificateHash - hash of the zkCertificate record leaf
     * @param merkleProof - Merkle proof of the zkCertificate record being in the tree
     */
    function revokeZkCertificate(
        uint256 leafIndex,
        bytes32 zkCertificateHash,
        bytes32[] memory merkleProof
    ) public override {
        humanIDSaltRegistry.onZkCertRevocation(leafIndex);
        super.revokeZkCertificate(leafIndex, zkCertificateHash, merkleProof);
    }
}
