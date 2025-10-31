// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;
pragma abicoder v2;

import {ZkCertificateRegistry} from './ZkCertificateRegistry.sol';
import {HumanIDSaltRegistry, SaltLockingZkCert} from './HumanIDSaltRegistry.sol';
import {RegistryOperation} from './interfaces/IWritableZKCertRegistry.sol';

/**
 * @title ZkCertificateRegistry
 * @author Galactica dev team
 * @notice A ZkCertificateRegistry for KYCs. It additionally makes sure that a unique salt is used for the humanID to make it unique and non-guessable.
 */
contract ZkKYCRegistry is ZkCertificateRegistry {
    HumanIDSaltRegistry public humanIDSaltRegistry;

    constructor() {
        // not used because the contract is behind a proxy and needs to be initialized instead
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract with this function because a smart contract behind a proxy can't have a constructor.
     * @param GuardianRegistry_ Address of the guardian registry.
     * @param treeDepth_ Depth of the Merkle tree.
     * @param description_ Description of the zkCertificate registry.
     */
    function initialize(
        address GuardianRegistry_,
        uint256 treeDepth_,
        string memory description_
    ) public override initializer {
        ZkCertificateRegistry.initialize(
            GuardianRegistry_,
            treeDepth_,
            description_
        );
        humanIDSaltRegistry = new HumanIDSaltRegistry(
            GuardianRegistry_,
            address(this)
        );
    }

    /**
     * @notice Register an operation about a zkCertificate to the queue.
     * @dev Only for revocation in zkKYC. Addition needs more parameters.
     * @param zkCertificateHash - Hash of the zkCertificate record leaf.
     * @param operation - Operation to add to the queue.
     */
    function addOperationToQueue(
        bytes32 zkCertificateHash,
        RegistryOperation operation
    ) public override {
        if (operation == RegistryOperation.Add) {
            revert(
                'ZkKYCRegistry: can not addOperationToQueue without the parameters for the salt registry'
            );
        } else if (operation == RegistryOperation.Revoke) {
            humanIDSaltRegistry.onZkCertRevocation(uint256(zkCertificateHash));
            super.addOperationToQueue(zkCertificateHash, operation);
        } else {
            revert('ZkKYCRegistry: invalid operation');
        }
    }

    /**
     * @notice Register an operation about a zkKYC certificate to the queue.
     * @param zkCertificateHash - hash of the zkCertificate record leaf
     * @param operation - Operation to add to the queue.
     * @param idHash - Hash identifying the user. It is supposed to be the poseidon hash of the name, birthday and citizenship.
     * @param saltHash - Hash of the salt, usually the commitment hash.
     * @param expirationTime - Expiration time of the zkKYC.
     */
    function addOperationToQueue(
        bytes32 zkCertificateHash,
        RegistryOperation operation,
        uint256 idHash,
        uint256 saltHash,
        uint256 expirationTime
    ) public {
        if (operation == RegistryOperation.Add) {
            // For privacy and sybil resistance, we need to register the salt hash for the user, so that a person can only have one salt.
            humanIDSaltRegistry.onZkCertIssuance(
                SaltLockingZkCert({
                    zkCertId: uint256(zkCertificateHash),
                    guardian: msg.sender,
                    expirationTime: expirationTime,
                    revoked: false
                }),
                idHash,
                saltHash
            );
        } else if (operation == RegistryOperation.Revoke) {
            revert(
                'ZkKYCRegistry: for revocation, use addOperationToQueue(bytes32, RegistryOperation)'
            );
        } else {
            revert('ZkKYCRegistry: invalid operation');
        }

        super.addOperationToQueue(zkCertificateHash, operation);
    }
}
