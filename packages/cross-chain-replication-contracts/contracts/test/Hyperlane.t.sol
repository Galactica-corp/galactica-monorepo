// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from 'forge-std/src/Test.sol';
import {TestRecipient} from '@hyperlane-xyz/core/contracts/test/TestRecipient.sol';
import {MockMailbox} from '@hyperlane-xyz/core/contracts/mock/MockMailbox.sol';
import {TypeCasts} from '@hyperlane-xyz/core/contracts/libs/TypeCasts.sol';

contract SimpleMessagingTest is Test {
  // origin and destination domains (recommended to be the chainId)
  uint32 origin = 1;
  uint32 destination = 2;

  // both mailboxes will be on the same chain but different addresses
  MockMailbox originMailbox;
  MockMailbox destinationMailbox;

  // contract which can receive messages
  TestRecipient receiver;

  function setUp() public {
    originMailbox = new MockMailbox(origin);
    destinationMailbox = new MockMailbox(destination);
    originMailbox.addRemoteMailbox(destination, destinationMailbox);

    receiver = new TestRecipient();
  }

  function testSendMessage() public {
    string memory _message = 'Aloha!';
    originMailbox.dispatch(
      destination,
      TypeCasts.addressToBytes32(address(receiver)),
      bytes(_message)
    );
    // simulating message delivery to the destinationMailbox
    destinationMailbox.processNextInboundMessage();
    assertEq(string(receiver.lastData()), _message);
  }
}
