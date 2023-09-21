// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

/// @author Galactica dev team
interface IKYCRegistry {
    function merkleRoot() external view returns (bytes32);
}
