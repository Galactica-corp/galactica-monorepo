// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const GuardianRegistryModule = buildModule(
  'GuardianRegistryModule',
  (module) => {
    const description = module.getParameter(
      'description',
      'ZkKYC GuardianRegistry',
    );

    const guardianRegistry = module.contract('GuardianRegistry', [description]);

    return { guardianRegistry };
  },
);

export default GuardianRegistryModule;
