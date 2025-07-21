// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import guardianRegistryModule from './GuardianRegistry.m';
import poseidonModule from './Poseidon.m';

const InfrastructureModule = buildModule('InfrastructureModule', (module) => {
  const { guardianRegistry } = module.useModule(guardianRegistryModule);
  const { poseidon } = module.useModule(poseidonModule);

  const merkleDepth = module.getParameter('merkleDepth', 32);
  const queueExpirationTime = module.getParameter('queueExpirationTime', 300); // 5 minutes default
  const description = module.getParameter('description', 'ZkKYC RecordRegistry');

  // Deploy ZkKYCRegistry
  const zkKYCRegistry = module.contract(
    'ZkKYCRegistry',
    [guardianRegistry, merkleDepth, description],
    {
      libraries: {
        PoseidonT3: poseidon,
      },
    },
  );

  // Change queue expiration time
  module.call(zkKYCRegistry, 'changeQueueExpirationTime', [queueExpirationTime]);

  // Deploy institutional contracts
  const institution1 = module.contract('MockGalacticaInstitution', [], {
    id: 'Institution1',
  });
  const institution2 = module.contract('MockGalacticaInstitution', [], {
    id: 'Institution2',
  });
  const institution3 = module.contract('MockGalacticaInstitution', [], {
    id: 'Institution3',
  });

  // Grant guardian roles to the institutions with proper parameters
  module.call(guardianRegistry, 'grantGuardianRole', [
    institution1,
    [1, 2], // dummy pubkey
    'Institution 1 metadata'
  ], { id: 'GrantGuardianRole1' });
  module.call(guardianRegistry, 'grantGuardianRole', [
    institution2,
    [3, 4], // dummy pubkey 
    'Institution 2 metadata'
  ], { id: 'GrantGuardianRole2' });
  module.call(guardianRegistry, 'grantGuardianRole', [
    institution3,
    [5, 6], // dummy pubkey
    'Institution 3 metadata'
  ], { id: 'GrantGuardianRole3' });

  // Get HumanIDSaltRegistry address from ZkKYCRegistry
  const humanIDSaltRegistryAddr = module.staticCall(
    zkKYCRegistry,
    'humanIDSaltRegistry',
    [],
  );

  return {
    guardianRegistry,
    poseidon,
    zkKYCRegistry,
    institution1,
    institution2,
    institution3,
    humanIDSaltRegistryAddr,
  };
});

export default InfrastructureModule;