// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

import "./Ownable.sol";

/**
* @title GuardianInfo struct containing data about a guardian's registration
*/
struct GuardianInfo {
    // Whether or not the guardian is whitelisted and active
    bool whitelisted;
    // The EdDSA public key of the guardian
    uint256[2] pubKey;
    // Name identifying the guardian, useful for frontends
    string name;
}


/// @author Galactica dev team
/// @title Smart contract storing whitelist of GNET guardians, for example KYC provider guardians
contract GuardianRegistry is Ownable {


    // a short description to describe which type of zkCertificate is managed by Guardians in this Registry

    string public description;
    mapping(address => GuardianInfo) public guardians;

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
        string indexed name,
        uint256 pubkey0,
        uint256 pubkey1
    );

    event GuardianRevocation(
        address indexed guardian,
        string indexed name,
        uint256 pubkey0,
        uint256 pubkey1
    );

    function _checkGuardian(address account) internal view {
        if (!guardians[account].whitelisted) {
            revert('GuardianRegistry: not a Guardian');
        }
    }

    function grantGuardianRole(
        address guardian,
        uint256[2] calldata pubKey,
        string calldata name
    ) public onlyOwner {
        guardians[guardian].whitelisted = true;
        // dev: do we need to check that the pubkey here indeed relates to the guardian?
        guardians[guardian].pubKey = pubKey;
        guardians[guardian].name = name;

        pubKeyToAddress[pubKey[0]][pubKey[1]] = guardian;
        emit GuardianAddition(guardian, name, pubKey[0], pubKey[1]);
    }

    function revokeGuardianRole(address guardian) public onlyOwner {
        guardians[guardian].whitelisted = false;
        emit GuardianRevocation(guardian, guardians[guardian].name, guardians[guardian].pubKey[0], guardians[guardian].pubKey[1]);
    }

    function renounceGuardianRole() public onlyOwner {
        guardians[msg.sender].whitelisted = false;
        emit GuardianRevocation(msg.sender, guardians[msg.sender].name, guardians[msg.sender].pubKey[0], guardians[msg.sender].pubKey[1]);
    }

    function isWhitelisted(address guardian) public view returns (bool) {
      return guardians[guardian].whitelisted;
    }
}
