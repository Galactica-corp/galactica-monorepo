// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import poseidonModule from '../Poseidon.m';

const Gip8ZkCertRegistryModule = buildModule(
  'Gip8ZkCertRegistryModule',
  (module) => {
    const { poseidon } = module.useModule(poseidonModule);

    const guardianRegistryDescription = module.getParameter(
      'guardianRegistryDescription',
      'Blum Guardian Registry',
    );

    const guardianRegistry = module.contract('GuardianRegistry', [
      guardianRegistryDescription,
    ]);

    const merkleDepth = module.getParameter('merkleDepth', 32);
    const zkCertRegistryDescription = module.getParameter(
      'zkCertRegistryDescription',
      'Blum ZkCertificate Registry',
    );

    const zkCertRegistry = module.contract(
      'ZkCertificateRegistry',
      [guardianRegistry, merkleDepth, zkCertRegistryDescription],
      {
        libraries: {
          PoseidonT3: poseidon,
        },
      },
    );

    return { guardianRegistry, zkCertRegistry };
  },
);

export default Gip8ZkCertRegistryModule;
