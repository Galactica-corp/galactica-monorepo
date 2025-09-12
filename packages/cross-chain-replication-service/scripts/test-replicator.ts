#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file from the service directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
config({ path: envPath });

import { network } from 'hardhat';
import {
  fromDecToHex,
  fromHexToBytes32,
  generateRandomBytes32Array,
  SparseMerkleTree,
} from '@galactica-net/zk-certificates';
import { buildEddsa } from 'circomlibjs';
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { CrossChainReplicator } from '../dist/replicator.js';
import { ZkCertificateRegistryAbi } from '../dist/contracts.js';

// Import deployment modules from the contracts package
import registryStateReceiverModule from '@galactica-net/cross-chain-replication-contracts/ignition/modules/RegistryStateReceiver.m.ts';
import registryStateSenderModule from '@galactica-net/cross-chain-replication-contracts/ignition/modules/RegistryStateSender.m.ts';
import testSetupModule from '@galactica-net/cross-chain-replication-contracts/ignition/modules/test/TestSetup.m.ts';

/**
 * Test script for the Cross-chain Replicator service
 * This script deploys contracts, starts the replicator, emits events, and verifies functionality
 */
async function testReplicatorService() {
  console.log('🚀 Starting Cross-chain Replicator Test...');

  // Test configuration
  const SOURCE_DOMAIN = 1;
  const DESTINATION_DOMAIN = 2;
  const MERKLE_TREE_DEPTH = 8;
  const BATCH_SIZE = 5;

  // Connect to Hardhat network
  const { ignition, networkHelpers } = await network.connect();
  const { loadFixture } = networkHelpers;

  /**
   * Fixture function to deploy all contracts for testing
   */
  async function deployContracts() {
    const {
      guardianRegistry,
      zkCertificateRegistry: registry,
      senderMailbox,
      receiverMailbox,
    } = await ignition.deploy(testSetupModule, {
      parameters: {
        TestSetupModule: {
          senderDomain: SOURCE_DOMAIN,
          receiverDomain: DESTINATION_DOMAIN,
          merkleDepth: MERKLE_TREE_DEPTH,
        },
      },
    });

    // Deploy RegistryStateSender
    const { sender } = await ignition.deploy(registryStateSenderModule, {
      parameters: {
        RegistryStateSenderModule: {
          mailbox: senderMailbox.address,
          registry: registry.address,
          destinationDomain: DESTINATION_DOMAIN,
          maxMerkleRootsPerMessage: BATCH_SIZE,
        },
      },
    });

    // Deploy RegistryStateReceiver and Replica
    const { replica, receiver } = await ignition.deploy(
      registryStateReceiverModule,
      {
        parameters: {
          ZkCertificateRegistryReplicaModule: {
            guardianRegistry: guardianRegistry.address,
            treeDepth: MERKLE_TREE_DEPTH,
          },
          RegistryStateReceiverModule: {
            mailbox: receiverMailbox.address,
            originDomain: SOURCE_DOMAIN,
            senderAddress: sender.address,
          },
        },
      },
    );

    // Initialize the sender
    await sender.write.initialize([receiver.address]);

    return {
      guardianRegistry,
      registry,
      replica,
      sender,
      receiver,
      senderMailbox,
      receiverMailbox,
    };
  }

  // Deploy contracts using fixture
  console.log('📦 Deploying contracts...');
  const contracts = await loadFixture(deployContracts);
  const { registry, sender, replica, receiver } = contracts;

  console.log('✅ Contracts deployed successfully');
  console.log(`Registry: ${registry.address}`);
  console.log(`Sender: ${sender.address}`);
  console.log(`Replica: ${replica.address}`);
  console.log(`Receiver: ${receiver.address}`);

  // Create viem clients for Hardhat network
  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http('http://127.0.0.1:8545'),
  });

  const walletClient = createWalletClient({
    chain: hardhat,
    transport: http('http://127.0.0.1:8545'),
  });

  // Use the default Hardhat account (same as used in integration tests)
  const account = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`;

  // Create the replicator
  const replicator = new CrossChainReplicator(
    publicClient,
    walletClient,
    account,
    registry.address as `0x${string}`,
    sender.address as `0x${string}`
  );

  // Start the replicator from the current block
  const startBlock = await publicClient.getBlockNumber();
  console.log(`🎧 Starting replicator from block ${startBlock}`);

  let eventDetected = false;
  let relayCalled = false;

  // Override the handleEvents method to track when events are processed
  const originalHandleEvents = replicator['handleEvents'].bind(replicator);
  replicator['handleEvents'] = async (logs: any[]) => {
    console.log(`📡 Detected ${logs.length} event(s)`);
    for (const log of logs) {
      console.log(`   Event: ${log.eventName} at block ${log.blockNumber}`);
    }
    eventDetected = true;
    await originalHandleEvents(logs);
  };

  // Override the relayState method to track when it's called
  const originalRelayState = replicator['relayState'].bind(replicator);
  replicator['relayState'] = async () => {
    console.log('🔄 Calling relayState()...');
    relayCalled = true;
    await originalRelayState();
  };

  await replicator.start(startBlock);

  // Give the replicator a moment to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Get current block before adding certificate
  const blockBeforeCert = await publicClient.getBlockNumber();
  console.log(`📊 Block before certificate addition: ${blockBeforeCert}`);

  // Now emit an event by adding a certificate
  console.log('📝 Adding a certificate to trigger event...');

  const eddsa = await buildEddsa();
  const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

  // Generate test certificate data
  const leafHash = generateRandomBytes32Array(1)[0];
  const leafIndex = Math.floor(Math.random() * 256);

  console.log(`Certificate: hash=${leafHash}, index=${leafIndex}`);

  // Register to queue and add certificate
  await registry.write.registerToQueue([leafHash]);

  const merkleProof = merkleTree.createProof(leafIndex);
  const merkleProofPath = merkleProof.pathElements.map((value) =>
    fromHexToBytes32(fromDecToHex(value)),
  );

  await registry.write.addZkCertificate([
    leafIndex,
    leafHash,
    merkleProofPath,
  ]);

  // Update merkle tree
  merkleTree.insertLeaves([leafHash], [leafIndex]);

  // Get block after certificate addition
  const blockAfterCert = await publicClient.getBlockNumber();
  console.log(`📊 Block after certificate addition: ${blockAfterCert}`);

  console.log('✅ Certificate added, event should be emitted');

  // Wait for the event to be processed (with timeout)
  const maxWaitTime = 10000; // 10 seconds
  const startTime = Date.now();

  while (!eventDetected && (Date.now() - startTime) < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!eventDetected) {
    throw new Error('❌ Event was not detected by the replicator');
  }

  console.log('✅ Event detected successfully');

  // Wait for relayState to be called (with timeout)
  const relayStartTime = Date.now();
  while (!relayCalled && (Date.now() - relayStartTime) < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!relayCalled) {
    throw new Error('❌ relayState() was not called by the replicator');
  }

  console.log('✅ relayState() called successfully');

  // Process the message on the destination mailbox
  console.log('📨 Processing message on destination mailbox...');
  await receiverMailbox.write.processNextInboundMessage();

  // Verify state replication
  console.log('🔍 Verifying state replication...');

  const sourceMerkleRoot = await registry.read.merkleRoot();
  const replicaMerkleRoot = await replica.read.merkleRoot();

  if (sourceMerkleRoot !== replicaMerkleRoot) {
    throw new Error(`❌ Merkle roots don't match: source=${sourceMerkleRoot}, replica=${replicaMerkleRoot}`);
  }

  const sourceValidIndex = await registry.read.merkleRootValidIndex();
  const replicaValidIndex = await replica.read.merkleRootValidIndex();

  if (sourceValidIndex !== replicaValidIndex) {
    throw new Error(`❌ Valid indices don't match: source=${sourceValidIndex}, replica=${replicaValidIndex}`);
  }

  const sourceQueuePointer = await registry.read.currentQueuePointer();
  const replicaQueuePointer = await replica.read.currentQueuePointer();

  if (sourceQueuePointer !== replicaQueuePointer) {
    throw new Error(`❌ Queue pointers don't match: source=${sourceQueuePointer}, replica=${replicaQueuePointer}`);
  }

  console.log('✅ State replication verified successfully');

  // Stop the replicator
  await replicator.stop();

  console.log('🎉 Cross-chain Replicator test completed successfully!');
  console.log('✅ Event detection: PASSED');
  console.log('✅ relayState() call: PASSED');
  console.log('✅ State replication: PASSED');
}

// Run the test
testReplicatorService().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
