// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

/// @author Galactica dev team
interface IZkCertificateRegistry {
    function merkleRoot() external view returns (bytes32);
    function merkleRootIndex(bytes32) external view returns (uint);
    function merkleRootValidIndex() external view returns (uint);
    function verifyMerkleRoot(bytes32) external view returns (bool);
    function guardianRegistry() external view returns (address);
}
