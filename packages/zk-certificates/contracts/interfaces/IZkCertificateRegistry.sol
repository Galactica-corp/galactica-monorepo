// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {IGuardianRegistry} from './IGuardianRegistry.sol';

/// @author Galactica dev team
interface IZkCertificateRegistry {
    function merkleRoot() external view returns (bytes32);

    function merkleRootIndex(bytes32) external view returns (uint);

    function merkleRootValidIndex() external view returns (uint);

    function verifyMerkleRoot(bytes32) external view returns (bool);

    function guardianRegistry() external view returns (IGuardianRegistry);

    /**
     * @notice Depricated function to share interface with old contract version.
     */
    function _GuardianRegistry() external view returns (IGuardianRegistry);
}
