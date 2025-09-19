// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { Future } from "@nomicfoundation/ignition-core";

/**
 * Using the Transparent Proxy pattern from OpenZeppelin: https://docs.openzeppelin.com/contracts/5.x/api/proxy#TransparentUpgradeableProxy
 * Documentation how to use it with Hardhat Ignition: https://hardhat.org/ignition/docs/guides/upgradeable-proxies
 *
 * @param module - The IgnitionModuleBuilder instance.
 * @param contractName - The name of the contract to deploy.
 * @param initCallArgs - The arguments to pass to the initialize function of the contract.
 * @returns The upgradable contract and the proxy contracts.
 */
export function defineUpgradableProxy(
  module: any /* IgnitionModuleBuilder*/,
  contractName: string,
  initCallArgs: any[],
  libraries?: Record<string, Future>,
) {
  // Deploying the staking logic contract
  const implementation = module.contract(contractName, [], {
    id: `ProxyImplementation${contractName}`,
    libraries: libraries,
  });

  // Call to initialize the staking contract when the proxy is deployed
  const encodedInitCall = module.encodeFunctionCall(
    implementation,
    'initialize',
    initCallArgs,
  );

  // Proxy infrastructure
  const proxyAdminOwner = module.getAccount(0); // deployer by default, can be changed later

  const proxy = module.contract(
    'TransparentUpgradeableProxy',
    [implementation, proxyAdminOwner, encodedInitCall],
    { id: `TransparentUpgradeableProxy${contractName}` },
  );

  const proxyAdminAddress = module.readEventArgument(
    proxy,
    'AdminChanged',
    'newAdmin',
    { id: `ProxyAdminAddress${contractName}` }
  );

  const proxyAdmin = module.contractAt('ProxyAdmin', proxyAdminAddress, {
    id: `ProxyAdmin${contractName}`,
  });

  // contract using the proxy
  const upgradableContract = module.contractAt(contractName, proxy, {
    id: `UpgradableContract${contractName}`,
  });

  return {
    upgradableContract,
    proxyContracts: { proxyAdmin, proxy },
  };
}