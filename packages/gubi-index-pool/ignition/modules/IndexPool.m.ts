// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import gUBIModule from './GUBI.m';
import { defineUpgradableProxy } from './UpgradableProxy.m';

const IndexPoolModule = buildModule('IndexPoolModule', (module) => {
  const { gUBI } = module.useModule(gUBIModule);

  const owner = module.getParameter('owner', module.getAccount(0));

  const { upgradableContract: indexPool, proxyContracts } =
    defineUpgradableProxy(module, 'IndexPool', [gUBI, owner]);

  return { indexPool, gUBI, ...proxyContracts };
});

export default IndexPoolModule;
