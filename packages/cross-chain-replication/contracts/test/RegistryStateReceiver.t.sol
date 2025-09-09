// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

import {Test} from 'forge-std/src/Test.sol';
import {MockMailbox} from '@hyperlane-xyz/core/contracts/mock/MockMailbox.sol';
import {TypeCasts} from '@hyperlane-xyz/core/contracts/libs/TypeCasts.sol';
import {RegistryStateReceiver} from '../RegistryStateReceiver.sol';
import {ZkCertificateRegistryReplica} from '../ZkCertificateRegistryReplica.sol';

contract RegistryStateReceiverTest is Test {
  RegistryStateReceiver receiver;
  MockMailbox mailbox;
  ZkCertificateRegistryReplica replica;

  // Test configuration
  uint32 constant ORIGIN_DOMAIN = 1;
  uint32 constant INVALID_ORIGIN_DOMAIN = 999;
  address constant INVALID_ADDRESS = address(0x456);
  address constant SENDER_ADDRESS = address(0x123);

  // Test data
  bytes32[] testMerkleRoots = [
    bytes32(0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0),
    bytes32(0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789)
  ];
  uint256 constant TEST_VALID_INDEX = 2;
  uint256 constant TEST_QUEUE_POINTER = 10;

  function setUp() public {
    // Deploy mock contracts
    mailbox = new MockMailbox(ORIGIN_DOMAIN);
    replica = new ZkCertificateRegistryReplica(
      'Test ZK Certificate Registry',
      32,
      address(0x99)
    );

    // Deploy the receiver contract first to get its address
    receiver = new RegistryStateReceiver(
      address(mailbox),
      address(replica),
      ORIGIN_DOMAIN,
      SENDER_ADDRESS
    );

    // Initialize the mock replica with the receiver as authorized updater
    replica.initialize(address(receiver));
  }

  function testDeployment() public view {
    // Check deployment and configuration
    assertEq(address(receiver.mailbox()), address(mailbox));
    assertEq(address(receiver.replicaRegistry()), address(replica));
    assertEq(receiver.originDomain(), ORIGIN_DOMAIN);
    assertEq(receiver.senderAddress(), SENDER_ADDRESS);
  }

  function testRevertWhenNotMailbox() public {
    // Create a valid message body
    bytes memory messageBody = abi.encode(
      testMerkleRoots,
      TEST_VALID_INDEX,
      TEST_QUEUE_POINTER
    );

    // Try to call handle directly (not through mailbox)
    vm.expectRevert('RegistryStateReceiver: caller is not the mailbox');
    receiver.handle(
      ORIGIN_DOMAIN,
      TypeCasts.addressToBytes32(SENDER_ADDRESS),
      messageBody
    );
  }

  function testRevertWhenInvalidOriginDomain() public {
    // Create a valid message body
    bytes memory messageBody = abi.encode(
      testMerkleRoots,
      TEST_VALID_INDEX,
      TEST_QUEUE_POINTER
    );

    // Try to call handle with invalid origin domain
    vm.expectRevert('RegistryStateReceiver: invalid origin domain');
    vm.prank(address(mailbox));
    receiver.handle(
      INVALID_ORIGIN_DOMAIN,
      TypeCasts.addressToBytes32(SENDER_ADDRESS),
      messageBody
    );
  }

  function testRevertWhenInvalidSenderAddress() public {
    // Create a valid message body
    bytes memory messageBody = abi.encode(
      testMerkleRoots,
      TEST_VALID_INDEX,
      TEST_QUEUE_POINTER
    );

    // Try to call handle with invalid sender address
    vm.expectRevert('RegistryStateReceiver: invalid sender address');
    vm.prank(address(mailbox));
    receiver.handle(
      ORIGIN_DOMAIN,
      TypeCasts.addressToBytes32(INVALID_ADDRESS),
      messageBody
    );
  }

  function testRevertWhenEmptyMerkleRoots() public {
    // Create message body with empty merkle roots array
    bytes32[] memory emptyRoots = new bytes32[](0);
    bytes memory messageBody = abi.encode(
      emptyRoots,
      TEST_VALID_INDEX,
      TEST_QUEUE_POINTER
    );

    // Try to call handle with empty merkle roots
    vm.expectRevert('Must provide at least one merkle root');
    vm.prank(address(mailbox));
    receiver.handle(
      ORIGIN_DOMAIN,
      TypeCasts.addressToBytes32(SENDER_ADDRESS),
      messageBody
    );
  }

  function testSuccessfulMessageHandling() public {
    // Create a valid message body
    bytes memory messageBody = abi.encode(
      testMerkleRoots,
      TEST_VALID_INDEX,
      TEST_QUEUE_POINTER
    );

    // Call handle through the mailbox
    vm.prank(address(mailbox));
    receiver.handle(
      ORIGIN_DOMAIN,
      TypeCasts.addressToBytes32(SENDER_ADDRESS),
      messageBody
    );

    // Verify that updateState was called on the mock replica with correct parameters
    assertEq(replica.merkleRootsLength(), testMerkleRoots.length);
    assertEq(replica.merkleRoot(), testMerkleRoots[testMerkleRoots.length - 1]);
    assertEq(replica.merkleRootValidIndex(), TEST_VALID_INDEX);
    assertEq(replica.currentQueuePointer(), TEST_QUEUE_POINTER);
  }

  function testEventEmission() public {
    // Create a valid message body
    bytes memory messageBody = abi.encode(
      testMerkleRoots,
      TEST_VALID_INDEX,
      TEST_QUEUE_POINTER
    );

    // Expect the StateReceived event to be emitted
    vm.expectEmit(true, true, false, true);
    emit RegistryStateReceiver.StateReceived(
      ORIGIN_DOMAIN,
      SENDER_ADDRESS,
      testMerkleRoots,
      TEST_VALID_INDEX,
      TEST_QUEUE_POINTER
    );

    // Call handle through the mailbox
    vm.prank(address(mailbox));
    receiver.handle(
      ORIGIN_DOMAIN,
      TypeCasts.addressToBytes32(SENDER_ADDRESS),
      messageBody
    );
  }

  function testSingleMerkleRootMessage() public {
    // Create message body with single merkle root
    bytes32[] memory singleRoot = new bytes32[](1);
    singleRoot[0] = testMerkleRoots[0];
    bytes memory messageBody = abi.encode(
      singleRoot,
      TEST_VALID_INDEX,
      TEST_QUEUE_POINTER
    );

    // Call handle through the mailbox
    vm.prank(address(mailbox));
    receiver.handle(
      ORIGIN_DOMAIN,
      TypeCasts.addressToBytes32(SENDER_ADDRESS),
      messageBody
    );

    // Verify that updateState was called with single root
    assertEq(replica.merkleRootsLength(), 1);
    assertEq(replica.merkleRoot(), testMerkleRoots[0]);
    assertEq(replica.merkleRootValidIndex(), TEST_VALID_INDEX);
    assertEq(replica.currentQueuePointer(), TEST_QUEUE_POINTER);
  }

  function testLargeMerkleRootsArray() public {
    // Create message body with many merkle roots
    bytes32[] memory manyRoots = new bytes32[](10);
    for (uint256 i = 0; i < 10; i++) {
      manyRoots[i] = keccak256(abi.encode(i));
    }
    bytes memory messageBody = abi.encode(
      manyRoots,
      TEST_VALID_INDEX,
      TEST_QUEUE_POINTER
    );

    // Call handle through the mailbox
    vm.prank(address(mailbox));
    receiver.handle(
      ORIGIN_DOMAIN,
      TypeCasts.addressToBytes32(SENDER_ADDRESS),
      messageBody
    );

    // Verify that updateState was called with all roots
    assertEq(replica.merkleRootsLength(), 10);
    for (uint256 i = 0; i < 10; i++) {
      assertEq(replica.getMerkleRoots(i, i + 1)[0], manyRoots[i]);
    }
  }
}
