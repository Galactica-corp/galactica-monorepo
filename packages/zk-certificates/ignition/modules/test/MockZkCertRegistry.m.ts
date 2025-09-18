// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const mockZkCertRegistryModule = buildModule(
  'MockZkCertRegistryModule',
  (module) => {
    const guardianRegistry = module.getParameter(
      'GuardianRegistry',
      '0x3C6d4E5bAf61b21267DE4181B1C4679c3c8441DB',
    );

    const zkCertRegistry = module.contract('MockZkCertificateRegistry', []);

    module.call(zkCertRegistry, 'setGuardianRegistry', [guardianRegistry]);

    return { zkCertRegistry };
  },
);

export default mockZkCertRegistryModule;
