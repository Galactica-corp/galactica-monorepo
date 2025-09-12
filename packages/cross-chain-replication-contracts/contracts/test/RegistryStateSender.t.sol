// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

import {Test} from 'forge-std/src/Test.sol';
import {RegistryStateSender} from '../RegistryStateSender.sol';
import {MockZkCertificateRegistry} from '@galactica-net/zk-certificates/contracts/mock/MockZkCertificateRegistry.sol';
import {MockMailbox} from '@hyperlane-xyz/core/contracts/mock/MockMailbox.sol';
import {TypeCasts} from '@hyperlane-xyz/core/contracts/libs/TypeCasts.sol';

contract RegistryStateSenderTest is Test {
  RegistryStateSender public sender;
  MockZkCertificateRegistry public mockRegistry;
  MockMailbox public mockMailbox;

  address public owner = address(1);
  address public nonOwner = address(2);
  address public receiverAddress = address(3);
  address public mockGuardianRegistry = address(4);

  uint32 public localDomain = 1;
  uint32 public destinationDomain = 2;
  uint256 public maxMerkleRootsPerMessage = 10;

  function setUp() public {
    // Deploy mock contracts
    mockMailbox = new MockMailbox(localDomain);
    mockRegistry = new MockZkCertificateRegistry();
    mockRegistry.setGuardianRegistry(mockGuardianRegistry);

    sender = new RegistryStateSender(
      address(mockMailbox),
      address(mockRegistry),
      destinationDomain,
      maxMerkleRootsPerMessage
    );

    // Initialize with receiver address
    sender.initialize(receiverAddress);

    // Setup mailbox connection for testing
    mockMailbox.addRemoteMailbox(
      destinationDomain,
      new MockMailbox(destinationDomain)
    );
  }

  function test_Constructor() public view {
    // Test constructor parameters
    assertEq(address(sender.mailbox()), address(mockMailbox));
    assertEq(address(sender.registry()), address(mockRegistry));
    assertEq(sender.destinationDomain(), destinationDomain);
    assertEq(sender.receiverAddress(), receiverAddress);
    assertEq(sender.maxMerkleRootsPerMessage(), maxMerkleRootsPerMessage);

    // Test initial state tracking
    (
      uint256 lastQueuePointer,
      uint256 lastMerkleRootValidIndex,
      uint256 lastSentMerkleRootsLength
    ) = sender.getLastProcessedState();
    assertEq(lastQueuePointer, 0); // Start from beginning
    assertEq(lastMerkleRootValidIndex, 1); // Start from beginning
    assertEq(lastSentMerkleRootsLength, 0); // Start from beginning
  }

  function test_Constructor_Reverts_ZeroMailbox() public {
    vm.expectRevert('RegistryStateSender: mailbox cannot be zero address');
    new RegistryStateSender(
      address(0),
      address(mockRegistry),
      destinationDomain,
      maxMerkleRootsPerMessage
    );
  }

  function test_Constructor_Reverts_ZeroRegistry() public {
    vm.expectRevert('RegistryStateSender: registry cannot be zero address');
    new RegistryStateSender(
      address(mockMailbox),
      address(0),
      destinationDomain,
      maxMerkleRootsPerMessage
    );
  }

  function test_Constructor_Reverts_ZeroDestinationDomain() public {
    vm.expectRevert('RegistryStateSender: destination domain cannot be zero');
    new RegistryStateSender(
      address(mockMailbox),
      address(mockRegistry),
      0,
      maxMerkleRootsPerMessage
    );
  }

  function test_Initialize_Reverts_ZeroReceiverAddress() public {
    RegistryStateSender uninitializedSender = new RegistryStateSender(
      address(mockMailbox),
      address(mockRegistry),
      destinationDomain,
      maxMerkleRootsPerMessage
    );

    vm.expectRevert('RegistryStateSender: receiver address cannot be zero');
    uninitializedSender.initialize(address(0));
  }

  function test_Constructor_Reverts_ZeroMaxMerkleRootsPerMessage() public {
    vm.expectRevert(
      'RegistryStateSender: max merkle roots per message must be greater than zero'
    );
    new RegistryStateSender(
      address(mockMailbox),
      address(mockRegistry),
      destinationDomain,
      0
    );
  }

  function test_RelayState_Reverts_NoNewStateChanges() public {
    // relay initial state
    sender.relayState{value: 1 ether}();

    // No state changes, should revert
    vm.expectRevert('RegistryStateSender: no new state changes to relay');
    sender.relayState();
  }

  function test_RelayState_InitialSyncOfEmptyRegistry() public {
    bytes32[] memory expectedRoots = new bytes32[](1);
    expectedRoots[0] = mockRegistry.merkleRoot();

    vm.expectEmit(true, true, true, true);
    emit RegistryStateSender.StateRelayed(expectedRoots, 1, 1, 0);

    sender.relayState{value: 1 ether}();

    // Check that state was updated
    (
      uint256 lastQueuePointer,
      uint256 lastMerkleRootValidIndex,
      uint256 lastSentMerkleRootsLength
    ) = sender.getLastProcessedState();
    assertEq(lastQueuePointer, 0);
    assertEq(lastMerkleRootValidIndex, 1);
    assertEq(lastSentMerkleRootsLength, 1);
  }

  function test_RelayState_Success_NewMerkleRoots() public {
    // relay initial state
    sender.relayState{value: 1 ether}();

    // Add new merkle roots to the registry
    bytes32 root1 = keccak256('root1');
    bytes32 root2 = keccak256('root2');
    mockRegistry.setMerkleRoot(root1);
    mockRegistry.setMerkleRoot(root2);

    // Update merkle root valid index
    mockRegistry.setMerkleRootValidIndex(3);
    mockRegistry.setCurrentQueuePointer(3);

    // Relay state
    bytes32[] memory expectedRoots = new bytes32[](2);
    expectedRoots[0] = root1;
    expectedRoots[1] = root2;

    vm.expectEmit(true, true, true, true);
    emit RegistryStateSender.StateRelayed(expectedRoots, 3, 3, 3);

    sender.relayState{value: 1 ether}();

    // Check that state was updated
    (
      uint256 lastQueuePointer,
      uint256 lastMerkleRootValidIndex,
      uint256 lastSentMerkleRootsLength
    ) = sender.getLastProcessedState();
    assertEq(lastQueuePointer, 3);
    assertEq(lastMerkleRootValidIndex, 3);
    assertEq(lastSentMerkleRootsLength, 3);
  }

  function test_RelayState_Success_NewQueuePointer() public {
    // relay initial state
    sender.relayState{value: 1 ether}();

    // Update queue pointer
    mockRegistry.setCurrentQueuePointer(5);

    // Relay state
    vm.expectEmit(true, true, true, true);
    emit RegistryStateSender.StateRelayed(
      new bytes32[](0), // No new merkle roots
      1, // No change in sent merkle roots length
      1, // No change in merkle root valid index
      5
    );

    sender.relayState{value: 1 ether}();

    // Check that state was updated
    (
      uint256 lastQueuePointer,
      uint256 lastMerkleRootValidIndex,
      uint256 lastSentMerkleRootsLength
    ) = sender.getLastProcessedState();
    assertEq(lastQueuePointer, 5);
    assertEq(lastMerkleRootValidIndex, 1);
    assertEq(lastSentMerkleRootsLength, 1);
  }

  function test_RelayState_Success_BothStateChanges() public {
    // relay initial state
    sender.relayState{value: 1 ether}();

    // Add new merkle roots and update queue pointer
    bytes32 root1 = keccak256('root1');
    mockRegistry.setMerkleRoot(root1);
    mockRegistry.setMerkleRootValidIndex(2);
    mockRegistry.setCurrentQueuePointer(3);

    // Relay state
    bytes32[] memory expectedRoots2 = new bytes32[](1);
    expectedRoots2[0] = root1;

    vm.expectEmit(true, true, true, true);
    emit RegistryStateSender.StateRelayed(expectedRoots2, 2, 2, 3);

    sender.relayState{value: 1 ether}();

    // Check that state was updated
    (
      uint256 lastQueuePointer,
      uint256 lastMerkleRootValidIndex,
      uint256 lastSentMerkleRootsLength
    ) = sender.getLastProcessedState();
    assertEq(lastQueuePointer, 3);
    assertEq(lastMerkleRootValidIndex, 2);
    assertEq(lastSentMerkleRootsLength, 2);
  }

  function test_RelayState_Success_IncrementalUpdates() public {
    // First update: add one root
    bytes32 root1 = keccak256('root1');
    mockRegistry.setMerkleRoot(root1);
    mockRegistry.setMerkleRootValidIndex(2);
    mockRegistry.setCurrentQueuePointer(1);

    sender.relayState{value: 1 ether}();

    // Second update: add another root
    bytes32 root2 = keccak256('root2');
    mockRegistry.setMerkleRoot(root2);
    mockRegistry.setMerkleRootValidIndex(3);
    mockRegistry.setCurrentQueuePointer(2);

    bytes32[] memory expectedRoots3 = new bytes32[](1);
    expectedRoots3[0] = root2;

    vm.expectEmit(true, true, true, true);
    emit RegistryStateSender.StateRelayed(
      expectedRoots3, // Only the new root
      3,
      3,
      2
    );

    sender.relayState{value: 1 ether}();

    // Check that state was updated correctly
    (
      uint256 lastQueuePointer,
      uint256 lastMerkleRootValidIndex,
      uint256 lastSentMerkleRootsLength
    ) = sender.getLastProcessedState();
    assertEq(lastQueuePointer, 2);
    assertEq(lastMerkleRootValidIndex, 3);
    assertEq(lastSentMerkleRootsLength, 3);
  }

  function test_QuoteRelayFee_Success() public {
    // Add some state to quote
    bytes32 root1 = keccak256('root1');
    mockRegistry.setMerkleRoot(root1);
    mockRegistry.setCurrentQueuePointer(1);

    // This should not revert and return a fee quote
    uint256 fee = sender.quoteRelayFee();
    // We can't predict the exact fee, but it should be >= 0
    assertGe(fee, 0);
  }

  function test_GetLastProcessedState() public view {
    (
      uint256 lastQueuePointer,
      uint256 lastMerkleRootValidIndex,
      uint256 lastSentMerkleRootsLength
    ) = sender.getLastProcessedState();
    assertEq(lastQueuePointer, 0);
    assertEq(lastMerkleRootValidIndex, 1);
    assertEq(lastSentMerkleRootsLength, 0);
  }

  function test_RelayState_CallsMailboxDispatch() public {
    // relay initial state
    sender.relayState{value: 1 ether}();

    // Add state change
    bytes32 root1 = keccak256('root1');
    mockRegistry.setMerkleRoot(root1);
    mockRegistry.setMerkleRootValidIndex(2); // Update to have one new root
    mockRegistry.setCurrentQueuePointer(1);

    // Create the expected dynamic array for newMerkleRoots
    bytes32[] memory expectedNewRoots = new bytes32[](1);
    expectedNewRoots[0] = root1;

    // Mock the mailbox dispatch call
    vm.expectCall(
      address(mockMailbox),
      abi.encodeWithSignature(
        'dispatch(uint32,bytes32,bytes)',
        destinationDomain,
        TypeCasts.addressToBytes32(receiverAddress),
        abi.encode(expectedNewRoots, uint256(2), uint256(1))
      )
    );

    sender.relayState{value: 1 ether}();
  }

  function test_Constructor_Reverts_ZeroMax2() public {
    vm.expectRevert(
      'RegistryStateSender: max merkle roots per message must be greater than zero'
    );
    new RegistryStateSender(
      address(mockMailbox),
      address(mockRegistry),
      destinationDomain,
      0
    );
  }

  function test_RelayState_MaxLimitExceeded() public {
    uint256 lowMaxLimit = 2;

    RegistryStateSender lowLimitSender = new RegistryStateSender(
      address(mockMailbox),
      address(mockRegistry),
      destinationDomain,
      lowMaxLimit
    );

    // Initialize the low limit sender
    lowLimitSender.initialize(receiverAddress);
    assertEq(lowLimitSender.maxMerkleRootsPerMessage(), lowMaxLimit);

    // relay initial state
    lowLimitSender.relayState{value: 1 ether}();

    // Lots of changes on the registry
    bytes32[] memory newRoots = new bytes32[](5);
    for (uint256 i = 0; i < newRoots.length; i++) {
      newRoots[i] = keccak256(abi.encodePacked('root', i));
      mockRegistry.setMerkleRoot(newRoots[i]);
    }
    mockRegistry.setMerkleRootValidIndex(4);
    mockRegistry.setCurrentQueuePointer(6);

    // first sync should send first 2 roots
    bytes32[] memory expectedRoots1 = new bytes32[](2);
    expectedRoots1[0] = newRoots[0];
    expectedRoots1[1] = newRoots[1];
    vm.expectEmit(true, true, true, true);
    emit RegistryStateSender.StateRelayed(expectedRoots1, 3, 4, 2);
    lowLimitSender.relayState{value: 1 ether}();

    // first sync should send first 2 roots
    bytes32[] memory expectedRoots2 = new bytes32[](2);
    expectedRoots2[0] = newRoots[2];
    expectedRoots2[1] = newRoots[3];
    vm.expectEmit(true, true, true, true);
    emit RegistryStateSender.StateRelayed(expectedRoots2, 5, 4, 4);
    lowLimitSender.relayState{value: 1 ether}();

    // final sync
    bytes32[] memory expectedRoots3 = new bytes32[](1);
    expectedRoots3[0] = newRoots[4];
    vm.expectEmit(true, true, true, true);
    emit RegistryStateSender.StateRelayed(expectedRoots3, 6, 4, 6);
    lowLimitSender.relayState{value: 1 ether}();
  }

  function test_Initialize_Success() public {
    RegistryStateSender uninitializedSender = new RegistryStateSender(
      address(mockMailbox),
      address(mockRegistry),
      destinationDomain,
      maxMerkleRootsPerMessage
    );

    // Should not be initialized initially
    assertFalse(uninitializedSender.initialized());
    assertEq(uninitializedSender.receiverAddress(), address(0));

    // Initialize
    uninitializedSender.initialize(receiverAddress);

    // Should be initialized now
    assertTrue(uninitializedSender.initialized());
    assertEq(uninitializedSender.receiverAddress(), receiverAddress);
  }

  function test_Initialize_Reverts_AlreadyInitialized() public {
    RegistryStateSender uninitializedSender = new RegistryStateSender(
      address(mockMailbox),
      address(mockRegistry),
      destinationDomain,
      maxMerkleRootsPerMessage
    );

    // First initialization should succeed
    uninitializedSender.initialize(receiverAddress);

    // Second initialization should revert
    vm.expectRevert('RegistryStateSender: already initialized');
    uninitializedSender.initialize(receiverAddress);
  }

  function test_RelayState_Reverts_NotInitialized() public {
    RegistryStateSender uninitializedSender = new RegistryStateSender(
      address(mockMailbox),
      address(mockRegistry),
      destinationDomain,
      maxMerkleRootsPerMessage
    );

    vm.expectRevert('RegistryStateSender: not initialized');
    uninitializedSender.relayState{value: 1 ether}();
  }

  function test_QuoteRelayFee_Reverts_NotInitialized() public {
    RegistryStateSender uninitializedSender = new RegistryStateSender(
      address(mockMailbox),
      address(mockRegistry),
      destinationDomain,
      maxMerkleRootsPerMessage
    );

    vm.expectRevert('RegistryStateSender: not initialized');
    uninitializedSender.quoteRelayFee();
  }

  function test_GetSyncStatus_InitialState_NoChanges() public {
    // relay initial state
    sender.relayState{value: 1 ether}();

    (
      uint256 merkleRootsLengthDiff,
      bool hasNewRevocation,
      uint256 queuePointerDiff
    ) = sender.getSyncStatus();

    assertEq(merkleRootsLengthDiff, 0);
    assertFalse(hasNewRevocation);
    assertEq(queuePointerDiff, 0);
  }

  function test_GetSyncStatus_WithAllChanges() public {
    // Relay initial state
    sender.relayState{value: 1 ether}();

    bytes32 root1 = keccak256('root1');
    mockRegistry.setMerkleRoot(root1);
    mockRegistry.setMerkleRootValidIndex(2);
    mockRegistry.setCurrentQueuePointer(3);

    (
      uint256 merkleRootsLengthDiff,
      bool hasNewRevocation,
      uint256 queuePointerDiff
    ) = sender.getSyncStatus();

    assertEq(merkleRootsLengthDiff, 1);
    assertTrue(hasNewRevocation);
    assertEq(queuePointerDiff, 3);
  }
}
