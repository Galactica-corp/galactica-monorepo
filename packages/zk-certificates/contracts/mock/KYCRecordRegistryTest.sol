// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.7;
pragma abicoder v2;

/// @author Galactica dev team
import {KYCRecordRegistry} from '../KYCRecordRegistry.sol';

contract KYCRecordRegistryTest is KYCRecordRegistry {
    constructor(address GuardianRegistry) {
        initializeKYCRecordRegistryTest(GuardianRegistry);
    }

    function doubleInit(address GuardianRegistry) external {
        KYCRecordRegistry.initializeKYCRecordRegistry(GuardianRegistry);
    }

    function initializeKYCRecordRegistryTest(
        address GuardianRegistry
    ) internal initializer {
        KYCRecordRegistry.initializeKYCRecordRegistry(GuardianRegistry);
    }
}
