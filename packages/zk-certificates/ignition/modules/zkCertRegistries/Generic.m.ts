// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import guardianRegistryModule from '../GuardianRegistry.m';
import poseidonModule from '../Poseidon.m';
import { defineUpgradableProxy } from '../UpgradableProxy.m';

const ZkCertRegistryModule = buildModule('ZkCertRegistryModule', (module) => {
  const { guardianRegistry } = module.useModule(guardianRegistryModule);
  const { poseidon } = module.useModule(poseidonModule);

  const merkleDepth = module.getParameter('merkleDepth', 32);
  const description = module.getParameter(
    'description',
    'Test ZkCertificate Registry',
  );

  const { upgradableContract: zkCertRegistry, proxyContracts } =
    defineUpgradableProxy(
      module,
      'ZkCertificateRegistry',
      [guardianRegistry, merkleDepth, description],
      {
        PoseidonT3: poseidon,
      },
    );

  return { zkCertRegistry, ...proxyContracts, guardianRegistry };
});

export default ZkCertRegistryModule;
