import { network } from 'hardhat';
import registryStateSenderModule from '../ignition/modules/RegistryStateSender.m.ts';
import registryStateReceiverModule from '../ignition/modules/RegistryStateReceiver.m.ts';

/**
 * Script for deploying the replica and receiver contracts to the destination chain.
 * 
 * To be migrated to a task later.
 */

// arguments
const deploymentId = 'cross-test-mock';
const originRegistry = '0x52c985CA1fa41Ca36bebe543cbb5dC93219252C3';
const guardianRegistry = '0x3C6d4E5bAf61b21267DE4181B1C4679c3c8441DB';
const treeDepth = 32;
const description = 'Test ZkCertificate Registry Replica';
const originDomain = 421614;
const senderMailbox = '0x598facE78a4302f11E3de0bee1894Da0b2Cb71F8';
const destinationDomain = 11155111;
const destinationMailbox = '0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766';
const maxMerkleRootsPerMessage = 50;
const originChain = 'arbitrumSepolia';
const originChainType = 'op';
const destinationChain = 'sepolia';
const destinationChainType = 'l1';

const origin = await network.connect({
  network: originChain,
  chainType: originChainType,
});
const destination = await network.connect({
  network: destinationChain,
  chainType: destinationChainType,
});


console.log('Deploying sender to origin chain');
const { sender } = await origin.ignition.deploy(registryStateSenderModule, {
  parameters: {
    RegistryStateSenderModule: {
      mailbox: senderMailbox,
      registry: originRegistry,
      destinationDomain: destinationDomain,
      maxMerkleRootsPerMessage: maxMerkleRootsPerMessage,
    },
  },
  deploymentId: `${deploymentId}-${originChain}`,
});
console.log('Sender deployed to', sender.address);

console.log('Deploying replica and receiver to destination chain');
const { replica, receiver } = await destination.ignition.deploy(registryStateReceiverModule, {
  parameters: {
    ZkCertificateRegistryReplicaModule: {
      guardianRegistry: guardianRegistry,
      treeDepth: treeDepth,
      description: description,
    },
    RegistryStateReceiverModule: {
      mailbox: destinationMailbox,
      originDomain: originDomain,
      senderAddress: sender.address,
    },
  },
  deploymentId: `${deploymentId}-${destinationChain}`,
});
console.log('Replica deployed to', replica.address);
console.log('Receiver deployed to', receiver.address);

console.log('Initializing sender with receiver address');
await sender.write.initialize([receiver.address]);
console.log('Sender initialized with receiver address');

console.log('Done');
