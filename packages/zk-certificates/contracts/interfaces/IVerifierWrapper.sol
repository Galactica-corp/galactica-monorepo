// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import {ICircomVerifier} from './ICircomVerifier.sol';

/// @author Galactica dev team
interface IVerifierWrapper {
    function verifier() external view returns (address);

    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) external view returns (bool);
}
