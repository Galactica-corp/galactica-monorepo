// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import GuardianRegistryModule from './GuardianRegistry.m';
import PoseidonModule from './Poseidon.m';

const ZkCertRegistryModule = buildModule('ZkCertRegistryModule', (m) => {
  const { guardianRegistry } = m.useModule(GuardianRegistryModule);
  const { poseidon } = m.useModule(PoseidonModule);

  const merkleDepth = m.getParameter('merkleDepth', 32);
  const description = m.getParameter('description', 'Test ZkCertificate Registry');

  const zkCertRegistry = m.contract("ZkCertificateRegistry", [guardianRegistry, merkleDepth, description], {
    libraries: {
      PoseidonT3: poseidon,
    },
  });

  return { zkCertRegistry };
});

export default ZkCertRegistryModule;
