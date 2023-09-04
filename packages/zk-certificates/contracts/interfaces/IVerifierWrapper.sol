// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

/// @author Galactica dev team
interface IVerifierWrapper {
    function verifier() external view returns (address);
}
