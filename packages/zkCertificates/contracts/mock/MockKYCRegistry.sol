// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

/// @author Galactica dev team
contract MockKYCRegistry {

    bytes32 public merkleRoot;
    mapping(bytes32 => bool) public rootHistory;
    
    function setMerkleRoot(bytes32 newMerkleRoot) public {
        rootHistory[newMerkleRoot] = true;
    }
}
