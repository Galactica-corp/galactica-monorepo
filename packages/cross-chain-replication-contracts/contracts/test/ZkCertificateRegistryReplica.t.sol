// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

import {Test} from 'forge-std/src/Test.sol';
import {ZkCertificateRegistryReplica} from '../ZkCertificateRegistryReplica.sol';

contract ZkCertificateRegistryReplicaTest is Test {
  ZkCertificateRegistryReplica replica;
  address owner = address(this);
  address authorizedUpdater = address(0x456);
  address nonAuthorized = address(0x123);

  // Test data
  string constant description = 'Test ZK Certificate Registry';
  uint256 constant treeDepth = 32;
  address mockGuardianRegistry = address(0x456);

  bytes32[] testMerkleRoots = [
    bytes32(0), // initial root at index 0 (not valid)
    bytes32(0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0),
    bytes32(0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789),
    bytes32(0x567890abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123)
  ];
  uint256 constant newMerkleRootValidIndex = 2;
  uint256 constant newQueuePointer = 5;

  function setUp() public {
    replica = new ZkCertificateRegistryReplica(
      description,
      treeDepth,
      mockGuardianRegistry
    );
    replica.initialize(authorizedUpdater);
  }

  function testInitialization() public {
    // Deploy a fresh contract for this test
    ZkCertificateRegistryReplica freshReplica = new ZkCertificateRegistryReplica(
        description,
        treeDepth,
        mockGuardianRegistry
      );

    // Check initial state before initialization
    assertEq(freshReplica.authorizedUpdater(), address(0));
    assertFalse(freshReplica.isInitialized());

    // Initialize
    freshReplica.initialize(authorizedUpdater);

    // Check state after initialization
    assertEq(freshReplica.authorizedUpdater(), authorizedUpdater);
    assertTrue(freshReplica.isInitialized());
  }

  function testCannotInitializeTwice() public {
    // Deploy a fresh contract for this test
    ZkCertificateRegistryReplica freshReplica = new ZkCertificateRegistryReplica(
        description,
        treeDepth,
        mockGuardianRegistry
      );

    // First initialization should work
    freshReplica.initialize(authorizedUpdater);

    // Second initialization should revert
    vm.expectRevert('ZkCertificateRegistryReplica: already initialized');
    freshReplica.initialize(nonAuthorized);
  }

  function testDeployment() public view {
    // Check deployment
    assertEq(address(replica), address(replica));

    // Check immutable parameters
    assertEq(replica.description(), description);
    assertEq(replica.treeDepth(), treeDepth);
    assertEq(replica.treeSize(), 2 ** treeDepth);
    assertEq(address(replica.guardianRegistry()), mockGuardianRegistry);

    // Check initial state
    assertEq(replica.merkleRootValidIndex(), 1);
    assertEq(replica.currentQueuePointer(), 0);
    assertEq(replica.merkleRoot(), bytes32(0));

    // Check initialization
    assertEq(replica.authorizedUpdater(), authorizedUpdater);
    assertTrue(replica.isInitialized());
  }

  function testAuthorizedUpdaterCanUpdateState() public {
    // Switch to authorized updater
    vm.prank(authorizedUpdater);

    // This should not revert
    replica.updateState(testMerkleRoots, testMerkleRoots[2], newQueuePointer);

    // Verify state was updated
    assertEq(replica.merkleRootValidIndex(), 2);
    assertEq(replica.currentQueuePointer(), newQueuePointer);
    assertEq(replica.merkleRoot(), testMerkleRoots[3]);
  }

  function testNonAuthorizedCannotUpdateState() public {
    // Switch to non-authorized
    vm.prank(nonAuthorized);

    // This should revert
    vm.expectRevert(
      'ZkCertificateRegistryReplica: caller is not authorized updater'
    );
    replica.updateState(testMerkleRoots, testMerkleRoots[0], newQueuePointer);
  }

  function testMultipleStateUpdates() public {
    // First update
    vm.prank(authorizedUpdater);
    bytes32[] memory firstRoots = new bytes32[](2);
    firstRoots[0] = testMerkleRoots[0];
    firstRoots[1] = testMerkleRoots[1];
    replica.updateState(firstRoots, testMerkleRoots[1], 1);

    assertEq(replica.merkleRoot(), testMerkleRoots[1]);
    assertEq(replica.merkleRootValidIndex(), 1);
    assertEq(replica.currentQueuePointer(), 1);

    // Second update
    vm.prank(authorizedUpdater);
    bytes32[] memory secondRoots = new bytes32[](2);
    secondRoots[0] = testMerkleRoots[2];
    secondRoots[1] = testMerkleRoots[3];
    replica.updateState(secondRoots, testMerkleRoots[2], 3);

    assertEq(replica.merkleRoot(), testMerkleRoots[3]);
    assertEq(replica.merkleRootValidIndex(), 2);
    assertEq(replica.currentQueuePointer(), 3);

    // Check total merkle roots
    bytes32[] memory allRoots = replica.getMerkleRoots(0);
    assertEq(allRoots.length, 4);
    assertEq(allRoots[0], testMerkleRoots[0]);
    assertEq(allRoots[1], testMerkleRoots[1]);
    assertEq(allRoots[2], testMerkleRoots[2]);
    assertEq(allRoots[3], testMerkleRoots[3]);
  }

  function testRevertWhenNoMerkleRoots() public {
    vm.prank(authorizedUpdater);
    bytes32[] memory emptyRoots = new bytes32[](0);

    vm.expectRevert('Must provide at least one merkle root');
    replica.updateState(emptyRoots, testMerkleRoots[0], newQueuePointer);
  }

  function testViewFunctionsAfterStateUpdate() public {
    // Set up some initial state
    vm.prank(authorizedUpdater);
    replica.updateState(testMerkleRoots, testMerkleRoots[1], newQueuePointer);

    // Test view functions
    assertEq(replica.merkleRoot(), testMerkleRoots[3]);
    assertEq(replica.merkleRootValidIndex(), 1);
    assertEq(replica.currentQueuePointer(), newQueuePointer);

    // Test getMerkleRoots
    bytes32[] memory roots = replica.getMerkleRoots(1);
    assertEq(roots.length, 3);
    assertEq(roots[0], testMerkleRoots[1]);
    assertEq(roots[1], testMerkleRoots[2]);

    // Test verifyMerkleRoot - all roots should be valid since validMerkleRoot is the first one
    assertFalse(replica.verifyMerkleRoot(testMerkleRoots[0]));
    assertTrue(replica.verifyMerkleRoot(testMerkleRoots[1]));
    assertTrue(replica.verifyMerkleRoot(testMerkleRoots[2]));
    assertTrue(replica.verifyMerkleRoot(testMerkleRoots[3]));
    assertFalse(
      replica.verifyMerkleRoot(
        bytes32(
          // random root
          0x4895621345678901234567890123456789012345678901234567890123456789
        )
      )
    );

    // Test merkleRootIndex
    assertEq(replica.merkleRootIndex(testMerkleRoots[0]), 0);
    assertEq(replica.merkleRootIndex(testMerkleRoots[1]), 1);
    assertEq(replica.merkleRootIndex(testMerkleRoots[2]), 2);
    assertEq(replica.merkleRootIndex(testMerkleRoots[3]), 3);
  }

  function testGetMerkleRootsOutOfBounds() public {
    // Set up some initial state
    vm.prank(authorizedUpdater);
    replica.updateState(
      testMerkleRoots,
      testMerkleRoots[2], // validMerkleRoot
      newQueuePointer
    );

    vm.expectRevert('Start index out of bounds');
    replica.getMerkleRoots(10); // Beyond array length
  }

  function testEmptyMerkleRootsArray() public {
    assertEq(replica.merkleRoot(), bytes32(0));

    vm.expectRevert('Start index out of bounds');
    replica.getMerkleRoots(0);
  }

  function testSingleMerkleRootUpdate() public {
    vm.prank(authorizedUpdater);
    bytes32[] memory singleRoot = new bytes32[](2);
    singleRoot[0] = testMerkleRoots[0];
    singleRoot[1] = testMerkleRoots[1];
    replica.updateState(singleRoot, testMerkleRoots[1], 1);

    assertEq(replica.merkleRoot(), testMerkleRoots[1]);
    assertEq(replica.merkleRootValidIndex(), 1);
    assertEq(replica.currentQueuePointer(), 1);
  }

  function testRevocationSync() public {
    vm.prank(authorizedUpdater);
    // First update with some certificate
    bytes32[] memory firstRoots = new bytes32[](1);
    firstRoots[0] = testMerkleRoots[0];
    replica.updateState(firstRoots, testMerkleRoots[0], 1);

    // Second update revoking the first one (simulate revocation by setting validMerkleRoot to testMerkleRoots[2])
    vm.prank(authorizedUpdater);
    bytes32[] memory secondRoots = new bytes32[](2);
    secondRoots[0] = testMerkleRoots[1];
    secondRoots[1] = testMerkleRoots[2];
    replica.updateState(secondRoots, testMerkleRoots[2], 3);

    assertEq(replica.verifyMerkleRoot(testMerkleRoots[0]), false);
    assertEq(replica.verifyMerkleRoot(testMerkleRoots[1]), false);
    assertEq(replica.verifyMerkleRoot(testMerkleRoots[2]), true);
  }

  function testDroppedMessageScenario() public {
    // First update with some root
    vm.prank(authorizedUpdater);
    bytes32[] memory firstRoots = new bytes32[](2);
    firstRoots[0] = testMerkleRoots[0];
    firstRoots[1] = testMerkleRoots[1];
    replica.updateState(firstRoots, testMerkleRoots[1], 1);

    // Simulate a dropped message scenario: testMerkleRoots[2] has not been submitted
    // This could happen if some messages were dropped during cross-chain transmission

    vm.prank(authorizedUpdater);
    bytes32[] memory secondRoots = new bytes32[](1);
    secondRoots[0] = testMerkleRoots[3];
    replica.updateState(secondRoots, testMerkleRoots[2], 3);

    assertEq(replica.merkleRootValidIndex(), 2);
    assertEq(replica.currentQueuePointer(), 3);

    // Invalid root from the beginning
    assertFalse(replica.verifyMerkleRoot(testMerkleRoots[0]));
    // Revoked root
    assertFalse(replica.verifyMerkleRoot(testMerkleRoots[1]));
    // Valid roots
    assertTrue(replica.verifyMerkleRoot(testMerkleRoots[2]));
    assertTrue(replica.verifyMerkleRoot(testMerkleRoots[3]));
  }

  function testValidMerkleRootExists() public {
    // First update
    vm.prank(authorizedUpdater);
    bytes32[] memory firstRoots = new bytes32[](1);
    firstRoots[0] = testMerkleRoots[0];
    replica.updateState(firstRoots, testMerkleRoots[0], 1);

    // Second update with validMerkleRoot that exists
    vm.prank(authorizedUpdater);
    bytes32[] memory secondRoots = new bytes32[](1);
    secondRoots[0] = testMerkleRoots[1];
    replica.updateState(secondRoots, testMerkleRoots[0], 2);

    // merkleRootValidIndex should be set to the index of the validMerkleRoot
    assertEq(replica.merkleRootIndex(testMerkleRoots[0]), 1);
    assertEq(replica.merkleRootValidIndex(), 1);
    assertEq(replica.currentQueuePointer(), 2);

    // All roots should be valid since validMerkleRoot marks the validity boundary
    assertTrue(replica.verifyMerkleRoot(testMerkleRoots[0]));
    assertTrue(replica.verifyMerkleRoot(testMerkleRoots[1]));
  }
}
