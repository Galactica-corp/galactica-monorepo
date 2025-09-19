// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { defineUpgradableProxy } from '../UpgradableProxy.m';

import poseidonModule from '../Poseidon.m';

const Gip7ZkCertRegistryModule = buildModule(
  'Gip7ZkCertRegistryModule',
  (module) => {
    const { poseidon } = module.useModule(poseidonModule);

    const guardianRegistryDescription = module.getParameter(
      'guardianRegistryDescription',
      'ExchangeData Guardian Registry',
    );

    const { upgradableContract: guardianRegistry, proxyContracts: guardianRegistryProxyContracts } = defineUpgradableProxy(
      module,
      'GuardianRegistry',
      [guardianRegistryDescription],
    );

    const merkleDepth = module.getParameter('merkleDepth', 32);
    const zkCertRegistryDescription = module.getParameter(
      'zkCertRegistryDescription',
      'ExchangeData ZkCertificate Registry',
    );

    const { upgradableContract: zkCertRegistry, proxyContracts: certificateRegistryProxyContracts } = defineUpgradableProxy(
      module,
      'ZkCertificateRegistry',
      [guardianRegistry, merkleDepth, zkCertRegistryDescription],
      {
        PoseidonT3: poseidon,
      },
    );

    return { guardianRegistry, zkCertRegistry, ...certificateRegistryProxyContracts, ...guardianRegistryProxyContracts };
  },
);

export default Gip7ZkCertRegistryModule;
