// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

/// @author Galactica dev team
interface IKYCRegistry {
    function rootHistory(bytes32 merkleRoot) external view returns (bool);
}
