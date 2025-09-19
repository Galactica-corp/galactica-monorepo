// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import guardianRegistryModule from './GuardianRegistry.m';
import poseidonModule from './Poseidon.m';
import institutionPubkeys from '../params/institution_pubkeys.json';

const InfrastructureModule = buildModule('InfrastructureModule', (module) => {
  const { poseidon } = module.useModule(poseidonModule);
  const { guardianRegistry: kycGuardianRegistry } = module.useModule(
    guardianRegistryModule,
  );

  const merkleDepth = module.getParameter('merkleDepth', 32);
  const queueExpirationTime = module.getParameter('queueExpirationTime', 60); // 1 min default
  const description = module.getParameter(
    'description',
    'ZkKYC RecordRegistry',
  );

  // Deploy ZkKYCRegistry
  const zkKYCRegistry = module.contract(
    'ZkKYCRegistry',
    [kycGuardianRegistry, merkleDepth, description],
    {
      libraries: {
        PoseidonT3: poseidon,
      },
    },
  );

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

  // Set institution pubkeys
  module.call(
    institution1,
    'setInstitutionPubkey',
    [institutionPubkeys.institutions.institution1.pubkey],
    { id: 'setInstitutionPubkey1' },
  );
  module.call(
    institution2,
    'setInstitutionPubkey',
    [institutionPubkeys.institutions.institution2.pubkey],
    { id: 'setInstitutionPubkey2' },
  );
  module.call(
    institution3,
    'setInstitutionPubkey',
    [institutionPubkeys.institutions.institution3.pubkey],
    { id: 'setInstitutionPubkey3' },
  );

  // Get HumanIDSaltRegistry address from ZkKYCRegistry
  const humanIDSaltRegistryAddr = module.staticCall(
    zkKYCRegistry,
    'humanIDSaltRegistry',
    [],
  );

  // Create contract instance for HumanIDSaltRegistry
  const humanIDSaltRegistry = module.contractAt(
    'HumanIDSaltRegistry',
    humanIDSaltRegistryAddr,
  );

  return {
    guardianRegistry: kycGuardianRegistry,
    poseidon,
    zkKYCRegistry,
    institution1,
    institution2,
    institution3,
    humanIDSaltRegistry,
  };
});

export default InfrastructureModule;
