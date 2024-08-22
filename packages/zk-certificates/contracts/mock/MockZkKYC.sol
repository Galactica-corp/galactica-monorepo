// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import '../interfaces/IZkKYCVerifier.sol';
import '../interfaces/IZkCertificateRegistry.sol';
import '../interfaces/IGalacticaInstitution.sol';

/// @author Galactica dev team
/// @title a mock ZkKYC which always returns true
contract MockZkKYC {

    uint public constant INDEX_HUMAN_ID = 0;
    uint public constant INDEX_USER_PUBKEY_AX = 1;
    uint public constant INDEX_USER_PUBKEY_AY = 2;
    uint public constant INDEX_VERIFICATION_EXPIRATION = 4;
    uint public constant INDEX_USER_ADDRESS = 7; // we mostly have 0 institutions in the mockZkKYC
    uint public constant INDEX_DAPP_ID = 8;
    uint public constant INDEX_PROVIDER_PUBKEY_AX = 9;
    uint public constant INDEX_PROVIDER_PUBKEY_AY = 10;

    //a, b, c are the proof
    // input array contains the public parameters: isValid, root, currentTime
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) public view returns (bool) {
        return true;
    }

    function verifyProof2(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) public view returns (bool) {
        return true;
    }

    function verifier() public pure returns (address) {
        return address(0);
    }
    
    function getAmountFraudInvestigationInstitutions() public pure returns (uint) {
        return 0;
    }
}
