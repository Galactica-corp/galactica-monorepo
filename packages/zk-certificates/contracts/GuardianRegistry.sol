// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

import './Ownable.sol';

/**
 * @title GuardianInfo struct containing data about a guardian's registration
 */
struct GuardianInfo {
    // Whether or not the guardian is whitelisted and active
    bool whitelisted;
    // The EdDSA public key of the guardian
    uint256[2] pubKey;
    // Link to guardian metadata json, see metadata schema in https://github.com/Galactica-corp/Documentation/blob/master/kyc-guardian-guide
    string metadataURL;
}

/**
 * @title GuardianIssuer struct containing data about a the accounts of a guardian that are allowed to issue zkCertificates
 */
struct GuardianIssuer {
    // The address of the guardian admin this issuer belongs to
    address admin;
}

/// @author Galactica dev team
/// @title Smart contract storing whitelist of GNET guardians, for example KYC provider guardians
contract GuardianRegistry is Ownable {
    // a short description to describe which type of zkCertificate is managed by Guardians in this Registry

    string public description;
    mapping(address => GuardianInfo) public guardians;
    mapping(address => GuardianIssuer) public issuerAccounts;

    mapping(uint256 => mapping(uint256 => address)) public pubKeyToAddress;

    modifier onlyGuardian() {
        _checkGuardian(msg.sender);
        _;
    }

    constructor(string memory _description) Ownable(msg.sender) {
        description = _description;
    }

    event GuardianAddition(
        address indexed guardian,
        string indexed metadataURL,
        uint256 pubkey0,
        uint256 pubkey1
    );

    event GuardianRevocation(
        address indexed guardian,
        string indexed metadataURL,
        uint256 pubkey0,
        uint256 pubkey1
    );

    event IssuerAddition(address indexed guardian, address indexed issuer);

    event IssuerRevocation(address indexed guardian, address indexed issuer);

    function _checkGuardian(address account) internal view {
        if (!guardians[account].whitelisted) {
            revert('GuardianRegistry: not a Guardian');
        }
    }

    function grantGuardianRole(
        address guardian,
        uint256[2] calldata pubKey,
        string calldata metadataURL
    ) public onlyOwner {
        guardians[guardian].whitelisted = true;
        // dev: do we need to check that the pubkey here indeed relates to the guardian?
        guardians[guardian].pubKey = pubKey;
        guardians[guardian].metadataURL = metadataURL;

        pubKeyToAddress[pubKey[0]][pubKey[1]] = guardian;
        emit GuardianAddition(guardian, metadataURL, pubKey[0], pubKey[1]);

        // the guardian is also an issuer of itself
        issuerAccounts[guardian].admin = guardian;
        emit IssuerAddition(guardian, guardian);
    }

    /**
     * The owner can revoke a guardian's role.
     * @param guardian - The guardian to revoke zkCert issuance rights from.
     */
    function revokeGuardianRole(address guardian) public onlyOwner {
        guardians[guardian].whitelisted = false;
        emit GuardianRevocation(
            guardian,
            guardians[guardian].metadataURL,
            guardians[guardian].pubKey[0],
            guardians[guardian].pubKey[1]
        );
    }

    /**
     * A guardian can renounce their own role as guardian.
     */
    function renounceGuardianRole() public {
        require(
            guardians[msg.sender].whitelisted,
            'GuardianRegistry: Only guardians may renounce their role'
        );
        guardians[msg.sender].whitelisted = false;
        emit GuardianRevocation(
            msg.sender,
            guardians[msg.sender].metadataURL,
            guardians[msg.sender].pubKey[0],
            guardians[msg.sender].pubKey[1]
        );
    }

    /**
     * Add an issuer account to a guardian's account.
     * @param issuer - This account may issue zkCerts on behalf of the guardian.
     */
    function addIssuerAccount(address issuer) public {
        require(
            guardians[msg.sender].whitelisted,
            'GuardianRegistry: Only guardian admins may add issuer accounts'
        );
        require(
            issuerAccounts[issuer].admin == address(0),
            'GuardianRegistry: Issuer may not belong to multiple guardians'
        );
        issuerAccounts[issuer].admin = msg.sender;
        emit IssuerAddition(msg.sender, issuer);
    }

    /**
     * Remove an issuer account from a guardian's account.
     * @param issuer - This account may no longer issue zkCerts on behalf of the guardian.
     */
    function removeIssuerAccount(address issuer) public {
        require(
            issuerAccounts[issuer].admin == msg.sender,
            'GuardianRegistry: Only guardian admin may remove this issuer accounts'
        );
        delete issuerAccounts[issuer];
        emit IssuerRevocation(msg.sender, issuer);
    }

    function isWhitelisted(address issuer) public view returns (bool) {
        address guardian = issuerAccounts[issuer].admin;
        return guardians[guardian].whitelisted;
    }
}
