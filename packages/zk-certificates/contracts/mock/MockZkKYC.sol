// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import '../interfaces/IZkKYCVerifier.sol';
import '../interfaces/IZkCertificateRegistry.sol';
import '../interfaces/IGalacticaInstitution.sol';

/// @author Galactica dev team
/// @title a mock ZkKYC which always returns true
contract MockZkKYC {

    uint public constant INDEX_HUMAN_ID = 0;
    uint public constant INDEX_DAPP_ID = 8;

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
}
