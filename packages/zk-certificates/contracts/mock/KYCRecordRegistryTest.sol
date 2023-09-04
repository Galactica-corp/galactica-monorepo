// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.7;
pragma abicoder v2;

/// @author Galactica dev team
import { KYCRecordRegistry } from "../KYCRecordRegistry.sol";

contract KYCRecordRegistryTest is KYCRecordRegistry {
  constructor(address KYCCenterRegistry) {
    initializeKYCRecordRegistryTest(KYCCenterRegistry);
  }

  function doubleInit(address KYCCenterRegistry) external {
    KYCRecordRegistry.initializeKYCRecordRegistry(KYCCenterRegistry);
  }

  function initializeKYCRecordRegistryTest(address KYCCenterRegistry) internal initializer {
    KYCRecordRegistry.initializeKYCRecordRegistry(KYCCenterRegistry);
  }

  function insertLeavesTest(bytes32[] memory _leafHashes) external {
    KYCRecordRegistry.insertLeaves(_leafHashes);
  }

  function setNextLeafIndex(uint256 _index) external {
    KYCRecordRegistry.nextLeafIndex = _index;
  }
}