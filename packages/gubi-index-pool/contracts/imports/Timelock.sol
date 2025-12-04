// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

// Just import the necessary contracts from OpenZeppelin to make them known to hardhat
import {TimelockController as TimelockControllerImported} from '@openzeppelin/contracts/governance/TimelockController.sol';

contract TimelockController is TimelockControllerImported {
  constructor(
    uint256 minDelay,
    address[] memory proposers,
    address[] memory executors,
    address admin
  ) TimelockControllerImported(minDelay, proposers, executors, admin) {}
}
