// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.7;
pragma abicoder v2;

import {GuardianRegistry} from './GuardianRegistry.sol';

struct SaltLockingZkCert {
    uint256 zkCertId;
    address guardian;
    uint256 expirationTime;
    bool revoked;
}

/**
 * @title HumanIDSaltRegistry
 * @author Galactica dev team
 * @notice Registry to limit a user to one salt to achieve a unique and single dApp specific humanID.
 */
contract HumanIDSaltRegistry {
    GuardianRegistry public guardianRegistry;
    address public zkCertRegistry;

    // mapping from  id hash to the salt hash
    mapping(uint256 => uint256) internal _registeredSaltHash;

    constructor(address guardianRegistry_, address zkCertRegistry_) {
        guardianRegistry = GuardianRegistry(guardianRegistry_);
        zkCertRegistry = zkCertRegistry_;
    }

    /**
     * @notice Register a salt hash for a user. Reverts if another salt is registered already. Saves zkCert data for eventual recovery.
     * @param zkCert - Data for the SaltLockingZkCert.
     * @param idHash - Hash identifying the user. It is supposed to be the poseidon Hash of the name, birthday and citizenship.
     * @param saltHash - Hash of the salt.
     */
    function onZkCertIssuance(
        SaltLockingZkCert calldata zkCert,
        uint256 idHash,
        uint256 saltHash
    ) external {
        require(
            msg.sender == zkCertRegistry,
            'HumanIDSaltRegistry: only zkCertRegistry can call this function'
        );

        _registerSaltHash(idHash, saltHash);
    }

    /**
     * @notice Inform salt registry about zkCert revocation. This helps resetting the salt before zkCert expiration if needed.
     * @param zkCertId - Id of the zkCert to be revoked.
     */
    function onZkCertRevocation(uint256 zkCertId) external {
        require(
            msg.sender == zkCertRegistry,
            'HumanIDSaltRegistry: only zkCertRegistry can call this function'
        );
    }

    /**
     * @notice Tries to reset a person's salt so they can register a new one. This is a recovery mechanism for unlucky users loosing their account. It only works if the user does not have any active zkCerts.
     * @param idHash - Hash identifying the user. It is supposed to be the poseidon Hash of the name, birthday and citizenship.
     * @return List of zkCerts blocking the reset. If it is [], the salt has been reset.
     */
    function resetSalt(
        uint256 idHash
    ) external returns (SaltLockingZkCert[] memory) {
        // TODO: only guardians can call this
    }

    /**
     * @notice Register a salt hash for a user. Reverts if another salt is registered already.
     * @param idHash - Hash identifying the user. It is supposed to be the poseidon Hash of the name, birthday and citizenship.
     * @param saltHash - Hash of the salt.
     */
    function _registerSaltHash(uint256 idHash, uint256 saltHash) internal {
        if (_registeredSaltHash[idHash] == 0) {
            // this is a new salt hash for a new or resetted user, so just register it
            _registeredSaltHash[idHash] = saltHash;
        } else {
            require(
                _registeredSaltHash[idHash] == saltHash,
                'HumanIDSaltRegistry: salt hash does not match the registered one'
            );
        }
    }
}
