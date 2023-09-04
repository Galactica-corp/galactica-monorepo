// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

/// @author Galactica dev team
contract MockGalacticaInstitution {

    uint[2] public institutionPubKey;
    
    function setInstitutionPubkey(uint[2] calldata newInstitutionPubKey) public {
        institutionPubKey[0] = newInstitutionPubKey[0];
        institutionPubKey[1] = newInstitutionPubKey[1];
    }
}