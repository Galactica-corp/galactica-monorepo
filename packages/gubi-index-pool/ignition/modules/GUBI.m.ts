// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const GUBIModule = buildModule('GUBIModule', (module) => {
  const owner = module.getParameter('owner', module.getAccount(0));

  const gUBI = module.contract('GUBI', [owner]);

  return { gUBI };
});

export default GUBIModule;
