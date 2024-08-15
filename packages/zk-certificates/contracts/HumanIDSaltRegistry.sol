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

struct UserData {
    // this is the registered salt hash for the user
    uint256 saltHash;
    // this is the list of zkCerts that might block resetting the salt
    uint256[] zkCerts;
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
    mapping(uint256 => UserData) internal _userData;
    mapping(uint256 => SaltLockingZkCert) internal _saltLockingZkCerts;

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

        _userData[idHash].zkCerts.push(zkCert.zkCertId);
        _saltLockingZkCerts[zkCert.zkCertId] = zkCert;
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

        _saltLockingZkCerts[zkCertId].revoked = true;
    }

    /**
     * @notice Tries to reset a person's salt so they can register a new one. This is a recovery mechanism for unlucky users loosing their account. It only works if the user does not have any active zkCerts.
     * @param idHash - Hash identifying the user. It is supposed to be the poseidon Hash of the name, birthday and citizenship.
     * @return List of zkCerts blocking the reset. If it is [], the salt has been reset.
     */
    function resetSalt(
        uint256 idHash
    ) external returns (SaltLockingZkCert[] memory) {
        require(
            guardianRegistry.isWhitelisted(msg.sender),
            'HumanIDSaltRegistry: only whitelisted guardians can call this function'
        );

        // count zkCerts that are still locking the salt
        uint256 blockingZkCertsCount = 0;
        for (uint256 i = 0; i < _userData[idHash].zkCerts.length; i++) {
            uint256 zkCertId = _userData[idHash].zkCerts[i];
            if (
                _saltLockingZkCerts[zkCertId].expirationTime >
                block.timestamp && // check if not expired
                !_saltLockingZkCerts[zkCertId].revoked // check if not revoked
            ) {
                blockingZkCertsCount++;
            }
        }

        // if there are no zkCerts, we can reset the salt
        if (blockingZkCertsCount == 0) {
            _userData[idHash].saltHash = 0;
            _userData[idHash].zkCerts = new uint256[](0);
            return new SaltLockingZkCert[](0);
        }

        // if there areblocking zkCerts, we need to return them to let the guardian know what is blocking the reset

        SaltLockingZkCert[] memory blockingZkCerts = new SaltLockingZkCert[](
            blockingZkCertsCount
        );
        uint256 fillIndex = 0;
        // go through all zkCerts and check if any of them is blocking
        for (uint256 i = 0; i < _userData[idHash].zkCerts.length; i++) {
            uint256 zkCertId = _userData[idHash].zkCerts[i];
            if (
                _saltLockingZkCerts[zkCertId].expirationTime >
                block.timestamp && // check if not expired
                !_saltLockingZkCerts[zkCertId].revoked // check if not revoked
            ) {
                blockingZkCerts[fillIndex] = _saltLockingZkCerts[zkCertId];
                fillIndex++;
            }
        }

        return blockingZkCerts;
    }

    /**
     * @notice Register a salt hash for a user. Reverts if another salt is registered already.
     * @param idHash - Hash identifying the user. It is supposed to be the poseidon Hash of the name, birthday and citizenship.
     * @param saltHash - Hash of the salt.
     */
    function _registerSaltHash(uint256 idHash, uint256 saltHash) internal {
        if (_userData[idHash].saltHash == 0) {
            // this is a new salt hash for a new or resetted user, so just register it
            _userData[idHash].saltHash = saltHash;
        } else {
            require(
                _userData[idHash].saltHash == saltHash,
                'HumanIDSaltRegistry: salt hash does not match the registered one'
            );
        }
    }
}
