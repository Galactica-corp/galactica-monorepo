// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

// Just import the necessary contracts from OpenZeppelin to make them known to hardhat
import {TransparentUpgradeableProxy as TransparentUpgradeableProxyImported} from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';
import {ProxyAdmin as ProxyAdminImported} from '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol';

contract ProxyAdmin is ProxyAdminImported {
  constructor(address initialOwner) ProxyAdminImported(initialOwner) {}
}

contract TransparentUpgradeableProxy is TransparentUpgradeableProxyImported {
  constructor(
    address implementation,
    address admin,
    bytes memory data
  ) TransparentUpgradeableProxyImported(implementation, admin, data) {}
}
