// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const GuardianRegistryModule = buildModule('GuardianRegistryModule', (m) => {
  const description = m.getParameter("description", "Test Guardian");

  const guardianRegistry = m.contract("GuardianRegistry", [description]);

  return { guardianRegistry };
});

export default GuardianRegistryModule;
