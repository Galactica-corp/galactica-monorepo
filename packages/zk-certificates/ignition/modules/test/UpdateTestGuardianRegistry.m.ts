// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import guardianRegistryModule from '../GuardianRegistry.m';

/**
 * Using the Transparent Proxy pattern from OpenZeppelin: https://docs.openzeppelin.com/contracts/5.x/api/proxy#TransparentUpgradeableProxy
 * Documentation how to use it with Hardhat Ignition: https://hardhat.org/ignition/docs/guides/upgradeable-proxies
 */
const UpgradedTestStakingModule = buildModule(
  'UpgradedTestStakingModule',
  (module) => {
    const { proxyAdmin, proxy } =
      module.useModule(guardianRegistryModule);

    const newVersion = module.getParameter('newVersion', '2.0.0');

    // Deploying the upgraded logic contract
    const upgradedGuardianRegistryImpl = module.contract('UpgradeTestGuardianRegistry', [], {
      id: 'UpgradeTestGuardianRegistryImplementation',
    });

    // Call to reinitialize the staking contract after the upgrade
    const encodedInitCall = module.encodeFunctionCall(
      upgradedGuardianRegistryImpl,
      'reinitialize',
      [newVersion],
    );

    // Upgrade the proxy to the new implementation
    module.call(proxyAdmin, 'upgradeAndCall', [proxy, upgradedGuardianRegistryImpl, encodedInitCall]);

    // V2 Staking interface using the proxy
    const upgradedGuardianRegistry = module.contractAt('UpgradeTestGuardianRegistry', proxy);

    return { upgradedGuardianRegistry, proxyAdmin, proxy };
  },
);

export default UpgradedTestStakingModule;