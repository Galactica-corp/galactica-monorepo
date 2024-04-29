// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.7;
pragma abicoder v2;

/// @author Galactica dev team
import {KYCRecordRegistry} from '../KYCRecordRegistry.sol';

contract KYCRecordRegistryTest is KYCRecordRegistry {
    constructor(address GuardianRegistry, uint256 treeDepth_) {
        initializeKYCRecordRegistryTest(GuardianRegistry, treeDepth_);
    }

    function doubleInit(address GuardianRegistry, uint256 treeDepth_) external {
        KYCRecordRegistry.initializeKYCRecordRegistry(
            GuardianRegistry,
            treeDepth_
        );
    }

    function initializeKYCRecordRegistryTest(
        address GuardianRegistry,
        uint256 treeDepth_
    ) internal initializer {
        KYCRecordRegistry.initializeKYCRecordRegistry(
            GuardianRegistry,
            treeDepth_
        );
    }
}
