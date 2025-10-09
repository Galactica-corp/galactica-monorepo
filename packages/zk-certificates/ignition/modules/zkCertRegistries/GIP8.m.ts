// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import poseidonModule from '../Poseidon.m';
import { defineUpgradableProxy } from '../UpgradableProxy.m';

const Gip8ZkCertRegistryModule = buildModule(
  'Gip8ZkCertRegistryModule',
  (module) => {
    const { poseidon } = module.useModule(poseidonModule);

    const guardianRegistryDescription = module.getParameter(
      'guardianRegistryDescription',
      'Blum Guardian Registry',
    );

    const {
      upgradableContract: guardianRegistry,
      proxyContracts: guardianRegistryProxyContracts,
    } = defineUpgradableProxy(module, 'GuardianRegistry', [
      guardianRegistryDescription,
    ]);

    const merkleDepth = module.getParameter('merkleDepth', 32);
    const zkCertRegistryDescription = module.getParameter(
      'zkCertRegistryDescription',
      'Blum ZkCertificate Registry',
    );

    const {
      upgradableContract: zkCertRegistry,
      proxyContracts: certificateRegistryProxyContracts,
    } = defineUpgradableProxy(
      module,
      'ZkCertificateRegistry',
      [guardianRegistry, merkleDepth, zkCertRegistryDescription],
      {
        PoseidonT3: poseidon,
      },
    );

    return {
      guardianRegistry,
      zkCertRegistry,
      ...certificateRegistryProxyContracts,
      ...guardianRegistryProxyContracts,
    };
  },
);

export default Gip8ZkCertRegistryModule;
