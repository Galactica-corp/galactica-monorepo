// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import {IKYCRegistry} from "../interfaces/IKYCRegistry.sol";

/// @author Galactica dev team
contract MockKYCRegistry is IKYCRegistry {
    bytes32 public merkleRoot;

    function setMerkleRoot(bytes32 newMerkleRoot) public {
        merkleRoot = newMerkleRoot;
    }
}
