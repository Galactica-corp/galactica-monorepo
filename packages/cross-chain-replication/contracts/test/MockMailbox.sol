// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

// Just importing some packages to make them known to hardhat
import {MockMailbox as MockMailboxImported} from '@hyperlane-xyz/core/contracts/mock/MockMailbox.sol';

contract MockMailbox is MockMailboxImported {
  constructor(uint32 domain) MockMailboxImported(domain) {}
}
