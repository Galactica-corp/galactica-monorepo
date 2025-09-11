import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { buildEddsa } from "circomlibjs";

import {
  fromDecToHex,
  fromHexToBytes32,
  generateRandomBytes32Array,
  SparseMerkleTree,
} from "@galactica-net/zk-certificates";

import testSetupModule from "../ignition/modules/test/TestSetup.m.ts";
import RegistryStateSenderModule from "../ignition/modules/RegistryStateSender.m.ts";
import RegistryStateReceiverModule from "../ignition/modules/RegistryStateReceiver.m.ts";


describe("Cross-Chain Replication Integration Test", async function () {
  // Test domains for Hyperlane
  const SOURCE_DOMAIN = 1; // Source chain domain
  const DESTINATION_DOMAIN = 2; // Destination chain domain
  const MERKLE_TREE_DEPTH = 8;
  const BATCH_SIZE = 5;

  const { viem, ignition, networkHelpers } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const loadFixture = networkHelpers.loadFixture;

  const [deployer, otherAccount] = await viem.getWalletClients();

  // Helper function to compare arrays
  function expectEqualArrays(a1: any[], a2: any[]) {
    const length1 = a1.length;
    const length2 = a2.length;
    assert.equal(length1, length2, "Array lengths don't match");
    for (let i = 0; i < length1; i++) {
      assert.equal(a1[i], a2[i], `Array elements at index ${i} don't match`);
    }
  }

  // Fixture function to deploy all contracts for testing
  async function deployContracts() {
    const { guardianRegistry, zkCertificateRegistry: registry, senderMailbox, receiverMailbox } = await ignition.deploy(testSetupModule, {
      parameters: {
        "TestSetupModule": {
          senderDomain: SOURCE_DOMAIN,
          receiverDomain: DESTINATION_DOMAIN,
          merkleDepth: MERKLE_TREE_DEPTH,
        },
      },
    });
    const { sender } = await ignition.deploy(RegistryStateSenderModule, {
      parameters: {
        "RegistryStateSenderModule": {
          mailbox: senderMailbox.address,
          registry: registry.address,
          destinationDomain: DESTINATION_DOMAIN,
          maxMerkleRootsPerMessage: BATCH_SIZE,
        },
      },
    });
    const { replica, receiver } = await ignition.deploy(RegistryStateReceiverModule, {
      parameters: {
        "ZkCertificateRegistryReplicaModule": {
          guardianRegistry: guardianRegistry.address,
          treeDepth: MERKLE_TREE_DEPTH,
        },
        "RegistryStateReceiverModule": {
          mailbox: receiverMailbox.address,
          originDomain: SOURCE_DOMAIN,
          senderAddress: sender.address,
        },
      },
    });

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

  async function addCertificateToSource(
    contracts: any,
    merkleTree: SparseMerkleTree,
    leafHash: string,
    leafIndex: number
  ) {
    const { registry } = contracts;

    await registry.write.registerToQueue([leafHash]);

    const merkleProof = merkleTree.createProof(leafIndex);
    const merkleProofPath = merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value))
    );

    await registry.write.addZkCertificate([
      leafIndex,
      leafHash,
      merkleProofPath
    ]);

    merkleTree.insertLeaves([leafHash], [leafIndex]);
  }

  // Helper function to revoke a certificate from the source registry
  async function revokeCertificateFromSource(
    contracts: any,
    merkleTree: SparseMerkleTree,
    leafHash: string,
    leafIndex: number
  ) {
    const { registry } = contracts;

    await registry.write.registerToQueue([leafHash]);

    const merkleProof = merkleTree.createProof(leafIndex);
    const merkleProofPath = merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value))
    );

    await registry.write.revokeZkCertificate([
      leafIndex,
      leafHash,
      merkleProofPath
    ]);

    merkleTree.insertLeaves([merkleTree.emptyLeaf], [leafIndex]);
  }

  // Helper function to trigger state relay
  async function relayState(contracts: any) {
    const { sender, receiverMailbox } = contracts;

    // Call relayState on sender
    await sender.write.relayState();

    // Process the message on the destination mailbox
    await receiverMailbox.write.processNextInboundMessage();
  }

  // Helper function to verify replica state matches source
  async function verifyReplicaState(contracts: any) {
    const { registry, replica } = contracts;

    const sourceMerkleRoot = await registry.read.merkleRoot();
    const replicaMerkleRoot = await replica.read.merkleRoot();
    assert.equal(sourceMerkleRoot, replicaMerkleRoot, "Merkle roots don't match");

    const sourceValidIndex = await registry.read.merkleRootValidIndex();
    const replicaValidIndex = await replica.read.merkleRootValidIndex();
    assert.equal(sourceValidIndex, replicaValidIndex, "Merkle root valid indices don't match");

    const sourceQueuePointer = await registry.read.currentQueuePointer();
    const replicaQueuePointer = await replica.read.currentQueuePointer();
    assert.equal(sourceQueuePointer, replicaQueuePointer, "Queue pointers don't match");

    const sourceRootsLength = await registry.read.merkleRootsLength();
    const replicaRootsLength = await replica.read.merkleRootsLength();
    assert.equal(sourceRootsLength, replicaRootsLength, "Merkle roots array lengths don't match");

    const sourceRoots = await registry.read.getMerkleRoots([0]);
    const replicaRoots = await replica.read.getMerkleRoots([0]);
    expectEqualArrays(sourceRoots, replicaRoots);
  }

  it("should successfully replicate certificate addition from source to replica", async function () {
    const contracts = await loadFixture(deployContracts);

    const eddsa = await buildEddsa();
    const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

    // Generate test data
    const leafHashes = generateRandomBytes32Array(1);
    const leafIndices = [Math.floor(Math.random() * 256)];

    await addCertificateToSource(contracts, merkleTree, leafHashes[0], leafIndices[0]);
    await relayState(contracts);
    await verifyReplicaState(contracts);
  });

  it("should successfully replicate certificate revocation from source to replica", async function () {
    const contracts = await loadFixture(deployContracts);

    const eddsa = await buildEddsa();
    const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

    // Generate test data
    const leafHashes = generateRandomBytes32Array(1);
    const leafIndices = [Math.floor(Math.random() * 256)];

    await addCertificateToSource(contracts, merkleTree, leafHashes[0], leafIndices[0]);
    await relayState(contracts);
    await verifyReplicaState(contracts);

    await revokeCertificateFromSource(contracts, merkleTree, leafHashes[0], leafIndices[0]);
    await relayState(contracts);
    await verifyReplicaState(contracts);
  });

  it("should successfully replicate batch certificate additions", async function () {
    const contracts = await loadFixture(deployContracts);

    const eddsa = await buildEddsa();
    const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

    // Generate test data for 3 batches
    const certificateAmount = BATCH_SIZE * 3 - 1; // -1 because the first root also needs to be replicated
    const leafHashes = generateRandomBytes32Array(certificateAmount);
    const leafIndices = Array.from({ length: certificateAmount }, () => Math.floor(Math.random() * 256));

    // Add certificates in batch
    for (let i = 0; i < certificateAmount; i++) {
      await addCertificateToSource(contracts, merkleTree, leafHashes[i], leafIndices[i]);
    }

    // Relay state to replica, needs to be called 3 times to ensure all certificates are replicated
    await relayState(contracts);
    await relayState(contracts);
    await relayState(contracts);

    // Verify replica state matches source
    await verifyReplicaState(contracts);
  });

  it("should handle multiple state updates correctly", async function () {
    const contracts = await loadFixture(deployContracts);

    const eddsa = await buildEddsa();
    const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

    // Generate test data
    const leafHashes = generateRandomBytes32Array(3);
    const leafIndices = Array.from({ length: 3 }, () => Math.floor(Math.random() * 256));

    // Add first certificate
    await addCertificateToSource(contracts, merkleTree, leafHashes[0], leafIndices[0]);
    await relayState(contracts);
    await verifyReplicaState(contracts);

    // Add second certificate
    await addCertificateToSource(contracts, merkleTree, leafHashes[1], leafIndices[1]);
    await relayState(contracts);
    await verifyReplicaState(contracts);

    // Revoke first certificate
    await revokeCertificateFromSource(contracts, merkleTree, leafHashes[0], leafIndices[0]);
    await relayState(contracts);
    await verifyReplicaState(contracts);

    // Add third certificate
    await addCertificateToSource(contracts, merkleTree, leafHashes[2], leafIndices[2]);
    await relayState(contracts);
    await verifyReplicaState(contracts);
  });

  it("should verify merkle root validity on replica", async function () {
    const contracts = await loadFixture(deployContracts);
    const { registry, replica } = contracts;

    const eddsa = await buildEddsa();
    const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

    // Generate test data
    const leafHashes = generateRandomBytes32Array(2);
    const leafIndices = Array.from({ length: 2 }, () => Math.floor(Math.random() * 256));

    // Add first certificate
    await addCertificateToSource(contracts, merkleTree, leafHashes[0], leafIndices[0]);
    const firstRoot = await registry.read.merkleRoot() as `0x${string}`;

    assert.equal(await replica.read.verifyMerkleRoot([
      firstRoot
    ]), false, "Merkle root should not yet be valid on replica");

    await relayState(contracts);

    const isValidOnReplica = await replica.read.verifyMerkleRoot([
      firstRoot
    ]);
    assert.equal(isValidOnReplica, true, "Merkle root should be valid on replica");

    // Add second certificate
    await addCertificateToSource(contracts, merkleTree, leafHashes[1], leafIndices[1]);
    const secondRoot = await registry.read.merkleRoot() as `0x${string}`;

    await relayState(contracts);

    assert.equal(await replica.read.verifyMerkleRoot([firstRoot]), true, "Old merkle root should still be valid");
    assert.equal(await replica.read.verifyMerkleRoot([secondRoot]), true, "New merkle root should be valid");

    // Revoke first certificate
    await revokeCertificateFromSource(contracts, merkleTree, leafHashes[0], leafIndices[0]);
    const latestMerkleRoot = await registry.read.merkleRoot() as `0x${string}`;

    await relayState(contracts);

    // Verify state was properly replicated
    const sourceRootsLength = await registry.read.merkleRootsLength();
    const sourceValidIndex = await registry.read.merkleRootValidIndex();
    const replicaRootsLength = await replica.read.merkleRootsLength();
    const replicaValidIndex = await replica.read.merkleRootValidIndex();

    assert.equal(sourceRootsLength, replicaRootsLength, "Source and replica should have same number of roots");
    assert.equal(sourceValidIndex, replicaValidIndex, "Source and replica should have same valid index");

    // After revocation, the merkleRootValidIndex is updated to the latest root index
    // So all roots up to the latest one should be valid
    assert.equal(await replica.read.verifyMerkleRoot([
      firstRoot
    ]), false, "Old merkle root should be revoked");
    assert.equal(await replica.read.verifyMerkleRoot([
      secondRoot
    ]), false, "Previous merkle root should be revoked");
    assert.equal(await replica.read.verifyMerkleRoot([
      latestMerkleRoot
    ]), true, "Latest merkle root should be valid after revocation");
  });
});
