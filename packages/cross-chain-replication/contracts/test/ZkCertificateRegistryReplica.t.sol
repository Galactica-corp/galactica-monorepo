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
    assertFalse(freshReplica.initialized());

    // Initialize
    freshReplica.initialize(authorizedUpdater);

    // Check state after initialization
    assertEq(freshReplica.authorizedUpdater(), authorizedUpdater);
    assertTrue(freshReplica.initialized());
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

  function testDeployment() public {
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
    assertTrue(replica.initialized());
  }

  function testAuthorizedUpdaterCanUpdateState() public {
    // Switch to authorized updater
    vm.prank(authorizedUpdater);

    // This should not revert
    replica.updateState(
      testMerkleRoots,
      newMerkleRootValidIndex,
      newQueuePointer
    );

    // Verify state was updated
    assertEq(replica.merkleRootValidIndex(), newMerkleRootValidIndex);
    assertEq(replica.currentQueuePointer(), newQueuePointer);
    assertEq(replica.merkleRoot(), testMerkleRoots[2]);
  }

  function testNonAuthorizedCannotUpdateState() public {
    // Switch to non-authorized
    vm.prank(nonAuthorized);

    // This should revert
    vm.expectRevert(
      'ZkCertificateRegistryReplica: caller is not authorized updater'
    );
    replica.updateState(
      testMerkleRoots,
      newMerkleRootValidIndex,
      newQueuePointer
    );
  }

  function testMultipleStateUpdates() public {
    // First update
    vm.prank(authorizedUpdater);
    bytes32[] memory firstRoots = new bytes32[](1);
    firstRoots[0] = testMerkleRoots[0];
    replica.updateState(firstRoots, 1, 1);

    assertEq(replica.merkleRoot(), firstRoots[0]);
    assertEq(replica.merkleRootValidIndex(), 1);
    assertEq(replica.currentQueuePointer(), 1);

    // Second update
    vm.prank(authorizedUpdater);
    bytes32[] memory secondRoots = new bytes32[](2);
    secondRoots[0] = testMerkleRoots[1];
    secondRoots[1] = testMerkleRoots[2];
    replica.updateState(secondRoots, 2, 3);

    assertEq(replica.merkleRoot(), testMerkleRoots[2]);
    assertEq(replica.merkleRootValidIndex(), 2);
    assertEq(replica.currentQueuePointer(), 3);

    // Check total merkle roots
    bytes32[] memory allRoots = replica.getMerkleRoots(0);
    assertEq(allRoots.length, 3);
    assertEq(allRoots[0], firstRoots[0]);
    assertEq(allRoots[1], secondRoots[0]);
    assertEq(allRoots[2], secondRoots[1]);
  }

  function testRevertWhenNoMerkleRoots() public {
    vm.prank(authorizedUpdater);
    bytes32[] memory emptyRoots = new bytes32[](0);

    vm.expectRevert('Must provide at least one merkle root');
    replica.updateState(emptyRoots, newMerkleRootValidIndex, newQueuePointer);
  }

  function testViewFunctionsAfterStateUpdate() public {
    // Set up some initial state
    vm.prank(authorizedUpdater);
    replica.updateState(
      testMerkleRoots,
      newMerkleRootValidIndex,
      newQueuePointer
    );

    // Test view functions
    assertEq(replica.merkleRoot(), testMerkleRoots[2]);
    assertEq(replica.merkleRootValidIndex(), newMerkleRootValidIndex);
    assertEq(replica.currentQueuePointer(), newQueuePointer);

    // Test getMerkleRoots
    bytes32[] memory roots = replica.getMerkleRoots(1);
    assertEq(roots.length, 2);
    assertEq(roots[0], testMerkleRoots[1]);
    assertEq(roots[1], testMerkleRoots[2]);

    // Test verifyMerkleRoot
    assertTrue(replica.verifyMerkleRoot(testMerkleRoots[2]));
    assertFalse(replica.verifyMerkleRoot(testMerkleRoots[1]));
    assertFalse(replica.verifyMerkleRoot(bytes32(0)));

    // Test merkleRootIndex
    assertEq(replica.merkleRootIndex(testMerkleRoots[0]), 0);
    assertEq(replica.merkleRootIndex(testMerkleRoots[1]), 1);
    assertEq(replica.merkleRootIndex(testMerkleRoots[2]), 2);
  }

  function testGetMerkleRootsOutOfBounds() public {
    // Set up some initial state
    vm.prank(authorizedUpdater);
    replica.updateState(
      testMerkleRoots,
      newMerkleRootValidIndex,
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
    bytes32[] memory singleRoot = new bytes32[](1);
    singleRoot[0] = testMerkleRoots[0];
    replica.updateState(singleRoot, 1, 1);

    assertEq(replica.merkleRoot(), testMerkleRoots[0]);
    assertEq(replica.merkleRootValidIndex(), 1);
    assertEq(replica.currentQueuePointer(), 1);
  }

  function testRevocationSync() public {
    vm.prank(authorizedUpdater);
    // First update with some certificate
    bytes32[] memory firstRoots = new bytes32[](1);
    firstRoots[0] = testMerkleRoots[0];
    replica.updateState(firstRoots, 1, 1);

    // Second update revoking the first one
    vm.prank(authorizedUpdater);
    bytes32[] memory secondRoots = new bytes32[](2);
    secondRoots[0] = testMerkleRoots[1];
    secondRoots[1] = testMerkleRoots[2];
    replica.updateState(secondRoots, 2, 3);

    assertEq(replica.verifyMerkleRoot(testMerkleRoots[0]), false);
    assertEq(replica.verifyMerkleRoot(testMerkleRoots[1]), false);
    assertEq(replica.verifyMerkleRoot(testMerkleRoots[2]), true);
  }
}
