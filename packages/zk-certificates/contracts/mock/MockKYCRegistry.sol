// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import {IZkCertificateRegistry} from "../interfaces/IZkCertificateRegistry.sol";

/// @author Galactica dev team
contract MockKYCRegistry is IZkCertificateRegistry {
    bytes32 public merkleRoot;

    function setMerkleRoot(bytes32 newMerkleRoot) public {
        merkleRoot = newMerkleRoot;
    }
}
