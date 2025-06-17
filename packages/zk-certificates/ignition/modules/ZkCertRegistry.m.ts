// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import guardianRegistryModule from './GuardianRegistry.m';
import poseidonModule from './Poseidon.m';

const ZkCertRegistryModule = buildModule('ZkCertRegistryModule', (module) => {
  const { guardianRegistry } = module.useModule(guardianRegistryModule);
  const { poseidon } = module.useModule(poseidonModule);

  const merkleDepth = module.getParameter('merkleDepth', 32);
  const description = module.getParameter(
    'description',
    'Test ZkCertificate Registry',
  );

  const zkCertRegistry = module.contract(
    'ZkCertificateRegistry',
    [guardianRegistry, merkleDepth, description],
    {
      libraries: {
        PoseidonT3: poseidon,
      },
    },
  );

  return { zkCertRegistry };
});

export default ZkCertRegistryModule;
