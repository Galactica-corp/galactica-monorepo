import {
  fromDecToHex,
  fromHexToBytes32,
  generateRandomBytes32Array,
  SparseMerkleTree,
} from '@galactica-net/zk-certificates';
import { buildEddsa } from 'circomlibjs';
import { network } from 'hardhat';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encodeAbiParameters, padHex, parseEther } from 'viem';

import registryStateReceiverModule from '../ignition/modules/RegistryStateReceiver.m.ts';
import registryStateSenderModule from '../ignition/modules/RegistryStateSender.m.ts';
import testSetupModule from '../ignition/modules/test/TestSetup.m.ts';

describe('Cross-Chain Replication Integration Test', async function () {
  // Test domains for Hyperlane
  const SOURCE_DOMAIN = 1; // Source chain domain
  const DESTINATION_DOMAIN = 2; // Destination chain domain
  const MERKLE_TREE_DEPTH = 8;
  const BATCH_SIZE = 5;

  const { ignition, networkHelpers } = await network.connect();
  const { loadFixture } = networkHelpers;

  /**
   * Helper function to compare arrays.
   *
   * @param a1 Array 1.
   * @param a2 Array 2.
   */
  function expectEqualArrays(a1: any[], a2: any[]) {
    const length1 = a1.length;
    const length2 = a2.length;
    assert.equal(length1, length2, "Array lengths don't match");
    for (let i = 0; i < length1; i++) {
      assert.equal(a1[i], a2[i], `Array elements at index ${i} don't match`);
    }
  }

  /**
   * Fixture function to deploy all contracts for testing.
   *
   * @returns Object with contracts.
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

  /**
   * Helper function to add a certificate to the source registry.
   *
   * @param contracts Object with contracts.
   * @param merkleTree Merkle tree.
   * @param leafHash Leaf hash.
   * @param leafIndex Leaf index.
   */
  async function addCertificateToSource(
    contracts: any,
    merkleTree: SparseMerkleTree,
    leafHash: string,
    leafIndex: number,
  ) {
    const { registry } = contracts;

    await registry.write.addOperationToQueue([leafHash, 0 /* RegistryOperation.Add */]);

    const merkleProof = merkleTree.createProof(leafIndex);
    const merkleProofPath = merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    );

    await registry.write.processNextOperation([
      leafIndex,
      leafHash,
      merkleProofPath,
    ]);

    merkleTree.insertLeaves([leafHash], [leafIndex]);
  }

  /**
   * Helper function to revoke a certificate from the source registry.
   *
   * @param contracts Object with contracts.
   * @param merkleTree Merkle tree.
   * @param leafHash Leaf hash.
   * @param leafIndex Leaf index.
   */
  async function revokeCertificateFromSource(
    contracts: any,
    merkleTree: SparseMerkleTree,
    leafHash: string,
    leafIndex: number,
  ) {
    const { registry } = contracts;

    await registry.write.addOperationToQueue([leafHash, 1 /* RegistryOperation.Revoke */]);

    const merkleProof = merkleTree.createProof(leafIndex);
    const merkleProofPath = merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    );

    await registry.write.processNextOperation([
      leafIndex,
      leafHash,
      merkleProofPath,
    ]);

    merkleTree.insertLeaves([merkleTree.emptyLeaf], [leafIndex]);
  }

  /**
   * Helper function to trigger state relay.
   *
   * @param contracts Object with contracts.
   */
  async function relayState(contracts: any) {
    const { sender, receiverMailbox } = contracts;

    // Get the fee for the relayState call
    const fee = await sender.read.quoteRelayFee();
    // Call relayState on sender
    await sender.write.relayState({ value: fee });

    // Process the message on the destination mailbox
    await receiverMailbox.write.processNextInboundMessage();
  }

  /**
   * Helper function to verify replica state matches source.
   *
   * @param contracts Object with contracts.
   */
  async function verifyReplicaState(contracts: any) {
    const { registry, replica } = contracts;

    const sourceMerkleRoot = await registry.read.merkleRoot();
    const replicaMerkleRoot = await replica.read.merkleRoot();
    assert.equal(
      sourceMerkleRoot,
      replicaMerkleRoot,
      "Merkle roots don't match",
    );

    const sourceValidIndex = await registry.read.merkleRootValidIndex();
    const replicaValidIndex = await replica.read.merkleRootValidIndex();
    assert.equal(
      sourceValidIndex,
      replicaValidIndex,
      "Merkle root valid indices don't match",
    );

    const sourceQueuePointer = await registry.read.currentQueuePointer();
    const replicaQueuePointer = await replica.read.currentQueuePointer();
    assert.equal(
      sourceQueuePointer,
      replicaQueuePointer,
      "Queue pointers don't match",
    );

    const sourceRootsLength = await registry.read.merkleRootsLength();
    const replicaRootsLength = await replica.read.merkleRootsLength();
    assert.equal(
      sourceRootsLength,
      replicaRootsLength,
      "Merkle roots array lengths don't match",
    );

    const sourceRoots = await registry.read.getMerkleRoots([0]);
    const replicaRoots = await replica.read.getMerkleRoots([0]);
    expectEqualArrays(sourceRoots, replicaRoots);
  }

  it('should successfully replicate certificate addition from source to replica', async function () {
    const contracts = await loadFixture(deployContracts);

    const eddsa = await buildEddsa();
    const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

    // Generate test data
    const leafHashes = generateRandomBytes32Array(1);
    const leafIndices = [Math.floor(Math.random() * 256)];

    await addCertificateToSource(
      contracts,
      merkleTree,
      leafHashes[0],
      leafIndices[0],
    );
    await relayState(contracts);
    await verifyReplicaState(contracts);
  });

  it('should successfully replicate certificate revocation from source to replica', async function () {
    const contracts = await loadFixture(deployContracts);

    const eddsa = await buildEddsa();
    const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

    // Generate test data
    const leafHashes = generateRandomBytes32Array(1);
    const leafIndices = [Math.floor(Math.random() * 256)];

    await addCertificateToSource(
      contracts,
      merkleTree,
      leafHashes[0],
      leafIndices[0],
    );
    await relayState(contracts);
    await verifyReplicaState(contracts);

    await revokeCertificateFromSource(
      contracts,
      merkleTree,
      leafHashes[0],
      leafIndices[0],
    );
    await relayState(contracts);
    await verifyReplicaState(contracts);
  });

  it('should successfully replicate batch certificate additions', async function () {
    const contracts = await loadFixture(deployContracts);

    const eddsa = await buildEddsa();
    const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

    // Generate test data for 3 batches
    const certificateAmount = BATCH_SIZE * 3 - 2; // -2 because the initial roots also needs to be replicated
    const leafHashes = generateRandomBytes32Array(certificateAmount);
    const leafIndices = Array.from({ length: certificateAmount }, (_, i) => i);

    // Add certificates in batch
    for (let i = 0; i < certificateAmount; i++) {
      await addCertificateToSource(
        contracts,
        merkleTree,
        leafHashes[i],
        leafIndices[i],
      );
    }

    // Relay state to replica, needs to be called 3 times to ensure all certificates are replicated
    await relayState(contracts);
    await relayState(contracts);
    await relayState(contracts);

    // Verify replica state matches source
    await verifyReplicaState(contracts);
  });

  it('should handle multiple state updates correctly', async function () {
    const contracts = await loadFixture(deployContracts);

    const eddsa = await buildEddsa();
    const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

    // Generate test data
    const leafHashes = generateRandomBytes32Array(3);
    const leafIndices = Array.from({ length: 3 }, (_, i) => i);

    // Add first certificate
    await addCertificateToSource(
      contracts,
      merkleTree,
      leafHashes[0],
      leafIndices[0],
    );
    await relayState(contracts);
    await verifyReplicaState(contracts);

    // Add second certificate
    await addCertificateToSource(
      contracts,
      merkleTree,
      leafHashes[1],
      leafIndices[1],
    );
    await relayState(contracts);
    await verifyReplicaState(contracts);

    // Revoke first certificate
    await revokeCertificateFromSource(
      contracts,
      merkleTree,
      leafHashes[0],
      leafIndices[0],
    );
    await relayState(contracts);
    await verifyReplicaState(contracts);

    // Add third certificate
    await addCertificateToSource(
      contracts,
      merkleTree,
      leafHashes[2],
      leafIndices[2],
    );
    await relayState(contracts);
    await verifyReplicaState(contracts);
  });

  it('should verify merkle root validity on replica', async function () {
    const contracts = await loadFixture(deployContracts);
    const { registry, replica } = contracts;

    const eddsa = await buildEddsa();
    const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

    // Generate test data
    const leafHashes = generateRandomBytes32Array(2);
    const leafIndices = Array.from({ length: 2 }, (_, i) => i);

    // Add first certificate
    await addCertificateToSource(
      contracts,
      merkleTree,
      leafHashes[0],
      leafIndices[0],
    );
    const firstRoot = (await registry.read.merkleRoot()) as `0x${string}`;

    assert.equal(
      await replica.read.verifyMerkleRoot([firstRoot]),
      false,
      'Merkle root should not yet be valid on replica',
    );

    await relayState(contracts);

    const isValidOnReplica = await replica.read.verifyMerkleRoot([firstRoot]);
    assert.equal(
      isValidOnReplica,
      true,
      'Merkle root should be valid on replica',
    );

    // Add second certificate
    await addCertificateToSource(
      contracts,
      merkleTree,
      leafHashes[1],
      leafIndices[1],
    );
    const secondRoot = (await registry.read.merkleRoot()) as `0x${string}`;

    await relayState(contracts);

    assert.equal(
      await replica.read.verifyMerkleRoot([firstRoot]),
      true,
      'Old merkle root should still be valid',
    );
    assert.equal(
      await replica.read.verifyMerkleRoot([secondRoot]),
      true,
      'New merkle root should be valid',
    );

    // Revoke first certificate
    await revokeCertificateFromSource(
      contracts,
      merkleTree,
      leafHashes[0],
      leafIndices[0],
    );
    const latestMerkleRoot =
      (await registry.read.merkleRoot()) as `0x${string}`;

    await relayState(contracts);

    // Verify state was properly replicated
    const sourceRootsLength = await registry.read.merkleRootsLength();
    const sourceValidIndex = await registry.read.merkleRootValidIndex();
    const replicaRootsLength = await replica.read.merkleRootsLength();
    const replicaValidIndex = await replica.read.merkleRootValidIndex();

    assert.equal(
      sourceRootsLength,
      replicaRootsLength,
      'Source and replica should have same number of roots',
    );
    assert.equal(
      sourceValidIndex,
      replicaValidIndex,
      'Source and replica should have same valid index',
    );

    // After revocation, the merkleRootValidIndex is updated to the latest root index
    // So all roots up to the latest one should be valid
    assert.equal(
      await replica.read.verifyMerkleRoot([firstRoot]),
      false,
      'Old merkle root should be revoked',
    );
    assert.equal(
      await replica.read.verifyMerkleRoot([secondRoot]),
      false,
      'Previous merkle root should be revoked',
    );
    assert.equal(
      await replica.read.verifyMerkleRoot([latestMerkleRoot]),
      true,
      'Latest merkle root should be valid after revocation',
    );
  });

  it('should handle dropped messages robustly', async function () {
    const contracts = await loadFixture(deployContracts);
    const { registry, replica, sender, receiver, receiverMailbox } = contracts;

    // Relay initial state
    await relayState(contracts);

    const eddsa = await buildEddsa();
    const merkleTree = new SparseMerkleTree(MERKLE_TREE_DEPTH, eddsa.poseidon);

    // Generate test data - more certificates to test batching
    const leafHashes = generateRandomBytes32Array(5);
    const leafIndices = Array.from({ length: 5 }, (_, i) => i);

    // Add first 3 certificates (message to be dropped)
    for (let i = 0; i < 3; i++) {
      await addCertificateToSource(
        contracts,
        merkleTree,
        leafHashes[i],
        leafIndices[i],
      );
    }

    // Add 2 more certificates (message to be sent)
    for (let i = 3; i < 5; i++) {
      await addCertificateToSource(
        contracts,
        merkleTree,
        leafHashes[i],
        leafIndices[i],
      );
    }

    // Simulate dropped message
    // Because the sender would send everything, we do not use it and instead directly calling the receiver handle function with the second message the sender would send
    const firstValidMerkleRoot = leafHashes[2] as `0x${string}`;
    const newMerkleRoots = (await registry.read.getMerkleRoots([
      4, 7,
    ])) as `0x${string}`[];
    const newQueuePointer =
      (await registry.read.currentQueuePointer()) as bigint;
    const message = encodeAbiParameters(
      [{ type: 'bytes32[]' }, { type: 'bytes32' }, { type: 'uint256' }],
      [newMerkleRoots, firstValidMerkleRoot, newQueuePointer],
    );

    // Impersonate the mailbox so we can call handle as if from the mailbox
    const mailboxAddress = receiverMailbox.address;
    // Mint some native tokens to the mailboxAddress using hardhat_setBalance, since the contract has no payable function, we can use
    await networkHelpers.setBalance(mailboxAddress, parseEther('1'));
    await networkHelpers.impersonateAccount(mailboxAddress);

    await receiver.write.handle(
      [SOURCE_DOMAIN, padHex(sender.address, { size: 32 }), message],
      { account: mailboxAddress },
    );

    // Verify that replica handled the dropped message correctly
    assert.equal(
      await replica.read.merkleRootsLength(),
      2n + 3n + 1n,
      'Replica should have all non-dropped roots + the initial roots + the oldest valid root',
    );

    assert.deepEqual(
      await replica.read.getMerkleRoots([0n]),
      [
        ...((await registry.read.getMerkleRoots([0, 2])) as `0x${string}`[]),
        firstValidMerkleRoot,
        ...((await registry.read.getMerkleRoots([4, 7])) as `0x${string}`[]),
      ],
      'List of roots should be consistent',
    );

    assert.equal(
      await replica.read.merkleRootValidIndex(),
      2n,
      'Valid index should be set to the oldest valid root when validMerkleRoot is missing',
    );

    assert.equal(
      await replica.read.merkleRoot(),
      await registry.read.merkleRoot(),
      'Latest root should be the same',
    );

    assert.equal(
      await replica.read.currentQueuePointer(),
      await registry.read.currentQueuePointer(),
      'CurrentQueuePointer should be the same',
    );
  });

  describe('should prevent unauthorized updates to replica registry', async function () {
    const newMerkleRoots = [generateRandomBytes32Array(1)[0] as `0x${string}`];
    const oldestValidMerkleRoot =
      '0x022772935ac77fe7bf9fb9de8726b97e36fca7d8679f6c59bb8eda958d2993d6';
    const newQueuePointer = 1n;

    const message = encodeAbiParameters(
      [{ type: 'bytes32[]' }, { type: 'bytes32' }, { type: 'uint256' }],
      [newMerkleRoots, oldestValidMerkleRoot, newQueuePointer],
    );

    it('should prevent unauthorized direct updates to replica registry', async function () {
      const contracts = await loadFixture(deployContracts);
      const { replica } = contracts;

      await assert.rejects(
        async () => {
          await replica.write.updateState([
            newMerkleRoots,
            oldestValidMerkleRoot,
            newQueuePointer,
          ]);
        },
        /caller is not authorized updater/u,
        'Unauthorized user should not be able to update replica state directly',
      );
    });

    it('should prevent unauthorized calls to receiver handle function', async function () {
      const contracts = await loadFixture(deployContracts);
      const { receiver, sender } = contracts;

      await assert.rejects(
        async () => {
          await receiver.write.handle([
            SOURCE_DOMAIN,
            padHex(sender.address, { size: 32 }),
            message,
          ]);
        },
        /caller is not the mailbox/u,
        'Unauthorized user should not be able to call receiver handle function',
      );
    });

    it('should reject messages from invalid origin domain', async function () {
      const contracts = await loadFixture(deployContracts);
      const { receiver, sender } = contracts;

      const invalidOriginDomain = 999; // Wrong domain

      try {
        await receiver.write.handle([
          invalidOriginDomain,
          padHex(sender.address, { size: 32 }),
          message,
        ]);
        assert.fail('Expected the call to revert, but it succeeded');
      } catch (error: any) {
        // The onlyMailbox modifier is checked first, so we expect that error
        assert(
          error.message.includes('caller is not the mailbox'),
          `Expected error to contain "caller is not the mailbox", but got: ${error.message}`,
        );
      }
    });

    it('should reject messages from unauthorized sender address', async function () {
      const contracts = await loadFixture(deployContracts);
      const { receiver, senderMailbox, receiverMailbox } = contracts;

      await senderMailbox.write.dispatch([
        DESTINATION_DOMAIN,
        padHex(receiver.address, { size: 32 }),
        message,
      ]);
      try {
        // Process the message on the destination mailbox
        await receiverMailbox.write.processNextInboundMessage();

        assert.fail(
          "Expected the call to succeed (mailbox doesn't validate sender)",
        );
      } catch (error: any) {
        assert(
          error.message.includes('invalid sender address'),
          `Expected error to contain "invalid sender address", but got: ${error.message}`,
        );
      }
    });
  });
});
