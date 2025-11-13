// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

// Just import the necessary contracts from OpenZeppelin to make them known to hardhat
import '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol';
import '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';
import '@openzeppelin/contracts/governance/TimelockController.sol';
