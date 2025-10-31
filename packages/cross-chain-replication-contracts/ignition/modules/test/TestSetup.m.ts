import guardianRegistryArtifact from '@galactica-net/zk-certificates/artifacts/contracts/GuardianRegistry.sol/GuardianRegistry.json' with { type: 'json' };
import poseidonT3Artifact from '@galactica-net/zk-certificates/artifacts/contracts/helpers/Poseidon.sol/PoseidonT3.json' with { type: 'json' };
import zkCertificateRegistryArtifact from '@galactica-net/zk-certificates/artifacts/contracts/ZkCertificateRegistry.sol/ZkCertificateRegistry.json' with { type: 'json' };
import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import mockMailboxArtifact from '../../../artifacts/contracts/test/MockMailbox.sol/MockMailbox.json' with { type: 'json' };

export default buildModule('TestSetupModule', (module) => {
  const senderDomain = module.getParameter('senderDomain', 1);
  const receiverDomain = module.getParameter('receiverDomain', 2);
  const merkleDepth = module.getParameter('merkleDepth', 8);

  const proxyAdminOwner = module.getAccount(0); // deployer by default, can be changed later

  // GuardianRegistry setup
  const guardianRegistryImplementation = module.contract(
    'GuardianRegistry',
    guardianRegistryArtifact,
    [],
    { id: `GuardianRegistryImplementation` },
  );
  const encodedInitCallGuardianRegistry = module.encodeFunctionCall(
    guardianRegistryImplementation,
    'initialize',
    ['Test Guardian Registry'],
  );
  const guardianRegistryProxy = module.contract(
    'TransparentUpgradeableProxy',
    [
      guardianRegistryImplementation,
      proxyAdminOwner,
      encodedInitCallGuardianRegistry,
    ],
    { id: `TransparentUpgradeableProxyGuardianRegistry` },
  );
  const guardianRegistry = module.contractAt(
    'GuardianRegistry',
    guardianRegistryArtifact,
    guardianRegistryProxy,
    {
      id: `GuardianRegistry`,
    },
  );
  module.call(guardianRegistry, 'grantGuardianRole', [
    module.getAccount(0),
    [0, 0],
    'test',
  ]);

  // ZkCertificateRegistry setup
  const poseidon = module.contract('PoseidonT3', poseidonT3Artifact);

  const zkCertificateRegistryImplementation = module.contract(
    'ZkCertificateRegistry',
    zkCertificateRegistryArtifact,
    [],
    {
      libraries: {
        PoseidonT3: poseidon,
      },
      id: `ZkCertificateRegistryImplementation`,
    },
  );
  const encodedInitCallZkCertificateRegistry = module.encodeFunctionCall(
    zkCertificateRegistryImplementation,
    'initialize',
    [guardianRegistryProxy, merkleDepth, 'Test ZkCertificate Registry'],
  );
  const zkCertificateRegistryProxy = module.contract(
    'TransparentUpgradeableProxy',
    [
      zkCertificateRegistryImplementation,
      proxyAdminOwner,
      encodedInitCallZkCertificateRegistry,
    ],
    { id: `TransparentUpgradeableProxyZkCertificateRegistry` },
  );
  const zkCertificateRegistry = module.contractAt(
    'ZkCertificateRegistry',
    zkCertificateRegistryArtifact,
    zkCertificateRegistryProxy,
    {
      id: `ZkCertificateRegistry`,
    },
  );

  // Hyperlane setup
  const senderMailbox = module.contract(
    'MockMailbox',
    mockMailboxArtifact,
    [senderDomain],
    { id: 'senderMailbox' },
  );
  const receiverMailbox = module.contract(
    'MockMailbox',
    mockMailboxArtifact,
    [receiverDomain],
    { id: 'receiverMailbox' },
  );

  module.call(senderMailbox, 'addRemoteMailbox', [
    receiverDomain,
    receiverMailbox,
  ]);
  module.call(receiverMailbox, 'addRemoteMailbox', [
    senderDomain,
    senderMailbox,
  ]);

  return {
    guardianRegistry,
    zkCertificateRegistry,
    senderMailbox,
    receiverMailbox,
    poseidon,
  };
});
