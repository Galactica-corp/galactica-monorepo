// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { defineUpgradableProxy } from './UpgradableProxy.m';


const GuardianRegistryModule = buildModule(
  'GuardianRegistryModule',
  (module) => {
    const description = module.getParameter(
      'description',
      'ZkKYC GuardianRegistry',
    );

    const { upgradableContract: guardianRegistry, proxyContracts } = defineUpgradableProxy(
      module,
      'GuardianRegistry',
      [description],
    );

    return { guardianRegistry, ...proxyContracts };
  },
);

export default GuardianRegistryModule;
