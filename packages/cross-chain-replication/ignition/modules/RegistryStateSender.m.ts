import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('RegistryStateSenderModule', (module) => {
  const mailbox = module.getParameter('mailbox');
  const registry = module.getParameter('registry');
  const destinationDomain = module.getParameter('destinationDomain');
  const maxMerkleRootsPerMessage = module.getParameter(
    'maxMerkleRootsPerMessage',
    50,
  );

  const sender = module.contract('RegistryStateSender', [
    mailbox,
    registry,
    destinationDomain,
    maxMerkleRootsPerMessage,
  ]);

  return { sender };
});
