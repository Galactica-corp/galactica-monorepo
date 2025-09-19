// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {GuardianRegistry} from '../GuardianRegistry.sol';

/**
 * @title UpgradeTestGuardianRegistry
 * @dev Test contract for testing the upgrade of the GuardianRegistry contract. It extends the original contract with a version string.
 */
contract UpgradeTestGuardianRegistry is GuardianRegistry {
    string public version;
    uint256[48] private __gap; // gap to provoke storage collisions

    /**
     * @notice Reinitialize the contract after an upgrade.
     */
    function reinitialize(string memory _version) public reinitializer(2) {
        version = _version;
    }
}
