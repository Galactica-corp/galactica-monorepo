/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { buildEddsa, poseidonContract } from 'circomlibjs';
import hre, { ignition } from 'hardhat';

import certificateRegistryModule from '../../ignition/modules/zkCertRegistries/Generic.m';
import {
  fromDecToHex,
  fromHexToBytes32,
  generateRandomBytes32Array,
  generateRandomNumberArray,
  overwriteArtifact,
} from '../../lib/helpers';
import { SparseMerkleTree } from '../../lib/sparseMerkleTree';
import type { GuardianRegistry } from '../../typechain-types/contracts/GuardianRegistry';
import type { ZkCertificateRegistry } from '../../typechain-types/contracts/ZkCertificateRegistry';

describe('ZkCertificateRegistry', () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    [deployer, user] = await hre.ethers.getSigners();
  });

  /**
   * Deploy fixtures to work with the same setup in an efficient way.
   *
   * @returns Fixtures.
   */
  async function deploy() {
    await overwriteArtifact(hre, 'PoseidonT3', poseidonContract.createCode(2));

    const {
      guardianRegistry: GuardianRegistry,
      zkCertRegistry: ZkCertificateRegistry,
    } = await ignition.deploy(certificateRegistryModule, {
      parameters: {
        GuardianRegistryModule: {
          description: 'Test Guardian Registry',
        },
        ZkCertRegistryModule: {
          merkleDepth: 32,
          description: 'Test Registry',
        },
      },
    });

    return {
      ZkCertificateRegistry:
        ZkCertificateRegistry as unknown as ZkCertificateRegistry,
      GuardianRegistry: GuardianRegistry as unknown as GuardianRegistry,
    };
  }

  /**
   * Tests the equality of two arrays.
   *
   * @param a1 - The first array to compare.
   * @param a2 - The second array to compare.
   */
  function expectEqualArrays(a1: any[], a2: any[]) {
    const length1 = a1.length;
    const length2 = a2.length;
    expect(length1).to.be.equal(length2);
  }

  it('should initialize values correctly', async () => {
    const { ZkCertificateRegistry, GuardianRegistry } =
      await loadFixture(deploy);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    expect(await ZkCertificateRegistry.description()).to.be.equal(
      'Test Registry',
    );
    expect(await ZkCertificateRegistry.treeDepth()).to.be.equal(32);
    expect(await ZkCertificateRegistry.guardianRegistry()).to.be.equal(
      await GuardianRegistry.getAddress(),
    );
    expect(await ZkCertificateRegistry.ZERO_VALUE()).to.not.be.equal(0n);

    expect(await ZkCertificateRegistry.merkleRootValidIndex()).to.be.equal(1);
    const merkleRoots =
      await ZkCertificateRegistry['getMerkleRoots(uint256)'](1);
    // normal "expect" doesn't compare arrays so we need to compare length and iterate over elements
    expectEqualArrays(merkleRoots, [
      fromHexToBytes32(fromDecToHex(merkleTree.root)),
    ]);
  });

  it('should insert elements', async function () {
    // we also check that queue variables are updated correctly
    const loops = 5;

    const { ZkCertificateRegistry, GuardianRegistry } =
      await loadFixture(deploy);

    // add deployer as a Guardian
    await GuardianRegistry.grantGuardianRole(deployer.address, [0, 0], 'test');

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    const leafHashes = generateRandomBytes32Array(5);
    const leafIndices = generateRandomNumberArray(5);
    const merkleRoots = [fromHexToBytes32(fromDecToHex(merkleTree.root))];
    for (let i = 0; i < loops; i += 1) {
      // add new zkCertificate and check the root
      const merkleProof = merkleTree.createProof(leafIndices[i]);
      const merkleProofPath = merkleProof.pathElements.map((value) =>
        fromHexToBytes32(fromDecToHex(value)),
      );
      await ZkCertificateRegistry.addOperationToQueue(
        leafHashes[i],
        0, // Add
      );

      const operationData =
        await ZkCertificateRegistry.zkCertificateProcessingData(leafHashes[i]);
      expect(operationData.state).to.be.equal(1n); // 1 is IssuanceQueued
      expect(operationData.queueIndex).to.be.equal(i);
      expect(operationData.guardian).to.be.equal(deployer.address);
      expect(await ZkCertificateRegistry.currentQueuePointer()).to.be.equal(i);

      await ZkCertificateRegistry.processNextOperation(
        leafIndices[i],
        leafHashes[i],
        merkleProofPath,
      );
      expect(await ZkCertificateRegistry.currentQueuePointer()).to.be.equal(
        i + 1,
      );

      merkleTree.insertLeaves([leafHashes[i]], [leafIndices[i]]);

      // Check roots match
      expect(await ZkCertificateRegistry.merkleRoot()).to.equal(
        fromHexToBytes32(fromDecToHex(merkleTree.root)),
      );
      merkleRoots.push(fromHexToBytes32(fromDecToHex(merkleTree.root)));
    }

    // check the merkle root array is correctly set
    const merkleRootsFromContract =
      await ZkCertificateRegistry['getMerkleRoots(uint256)'](1);
    expectEqualArrays(merkleRootsFromContract, merkleRoots);
    expect(await ZkCertificateRegistry.merkleRootValidIndex()).to.be.equal(1);
    for (let i = 0; i < merkleRoots.length; i++) {
      expect(
        await ZkCertificateRegistry.merkleRootIndex(merkleRoots[i]),
      ).to.be.equal(i + 1);
    }
  });

  it('should be able to nullify a leaf', async function () {
    const loops = 5;

    const { ZkCertificateRegistry, GuardianRegistry } =
      await loadFixture(deploy);

    // add deployer as a Guardian
    await GuardianRegistry.grantGuardianRole(deployer.address, [0, 0], 'test');

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    const leafHashes = generateRandomBytes32Array(loops);
    const leafIndices = generateRandomNumberArray(loops);
    for (let i = 0; i < loops; i += 1) {
      // add new zkKYCRecord
      const merkleProof = merkleTree.createProof(leafIndices[i]);
      const merkleProofPath = merkleProof.pathElements.map((value) =>
        fromHexToBytes32(fromDecToHex(value)),
      );
      // firstly we need to register the hash to the queue
      await ZkCertificateRegistry.addOperationToQueue(leafHashes[i], 0);
      await ZkCertificateRegistry.processNextOperation(
        leafIndices[i],
        leafHashes[i],
        merkleProofPath,
      );
      merkleTree.insertLeaves([leafHashes[i]], [leafIndices[i]]);
    }

    // now we will try to nullify the third added leaf
    const leafIndex = 2;
    const merkleProof = merkleTree.createProof(leafIndices[leafIndex]);
    const merkleProofPath = merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    );
    // we need to register the zkCertificate hash to the queue
    await ZkCertificateRegistry.addOperationToQueue(
      leafHashes[leafIndex],
      1, // Revoke
    );
    let operationData = await ZkCertificateRegistry.zkCertificateProcessingData(
      leafHashes[leafIndex],
    );
    expect(operationData.state).to.be.equal(3n); // RevocationQueued
    expect(operationData.queueIndex).to.be.equal(loops);
    expect(operationData.guardian).to.be.equal(deployer.address);
    expect(await ZkCertificateRegistry.currentQueuePointer()).to.be.equal(
      loops,
    );

    await ZkCertificateRegistry.processNextOperation(
      leafIndices[leafIndex],
      leafHashes[leafIndex],
      merkleProofPath,
    );
    expect(await ZkCertificateRegistry.currentQueuePointer()).to.be.equal(
      loops + 1,
    );
    operationData = await ZkCertificateRegistry.zkCertificateProcessingData(
      leafHashes[leafIndex],
    );
    expect(operationData.state).to.be.equal(4n); // Revoked

    merkleTree.insertLeaves([merkleTree.emptyLeaf], [leafIndices[leafIndex]]);

    // Check roots match
    expect(await ZkCertificateRegistry.merkleRoot()).to.equal(
      fromHexToBytes32(fromDecToHex(merkleTree.root)),
    );

    expect(await ZkCertificateRegistry.merkleRootValidIndex()).to.be.equal(
      loops + 2,
    );
  });

  it('only Guardian can register to the queue and add leaf', async function () {
    const { ZkCertificateRegistry, GuardianRegistry } =
      await loadFixture(deploy);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    const leafHashes = generateRandomBytes32Array(1);
    const leafIndices = generateRandomNumberArray(1);
    // add new zkCertificate and check the root
    const merkleProof = merkleTree.createProof(leafIndices[0]);
    const merkleProofPath = merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    );

    await expect(
      ZkCertificateRegistry.addOperationToQueue(leafHashes[0], 0),
    ).to.be.revertedWith('ZkCertificateRegistry: not a Guardian');

    // add deployer as a Guardian
    await GuardianRegistry.grantGuardianRole(deployer.address, [0, 0], 'test');

    // now the deployer can register to the queue
    await ZkCertificateRegistry.addOperationToQueue(leafHashes[0], 0);

    // but a random user can process the operation
    await ZkCertificateRegistry.connect(user).processNextOperation(
      leafIndices[0],
      leafHashes[0],
      merkleProofPath,
    );
    const operationData =
      await ZkCertificateRegistry.zkCertificateProcessingData(leafHashes[0]);
    expect(operationData.state).to.be.equal(2n); // 2 is Issued
    expect(operationData.queueIndex).to.be.equal(0);
    expect(operationData.guardian).to.be.equal(deployer.address);
    expect(await ZkCertificateRegistry.currentQueuePointer()).to.be.equal(1);
  });

  it('elements in the queue cannot be skipped', async function () {
    // we also check that queue variables are updated correctly
    const loops = 5;

    const { ZkCertificateRegistry, GuardianRegistry } =
      await loadFixture(deploy);

    // add deployer as a Guardian
    await GuardianRegistry.grantGuardianRole(deployer.address, [0, 0], 'test');

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    const leafHashes = generateRandomBytes32Array(5);
    const leafIndices = generateRandomNumberArray(5);
    // enqueue operations
    for (let i = 0; i < loops; i += 1) {
      await ZkCertificateRegistry.addOperationToQueue(leafHashes[i], 0);
    }

    let merkleProof = merkleTree.createProof(leafIndices[loops - 1]);
    let merkleProofPath = merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    );

    await expect(
      ZkCertificateRegistry.processNextOperation(
        leafIndices[loops - 1],
        leafHashes[loops - 1],
        merkleProofPath,
      ),
    ).to.be.revertedWith(
      'ZkCertificateRegistry: zkCertificate is not in turn to be processed',
    );

    // process prior operations to advance pointer
    for (let j = 0; j < loops - 1; j += 1) {
      const mpj = merkleTree.createProof(leafIndices[j]);
      const mpjPath = mpj.pathElements.map((value) =>
        fromHexToBytes32(fromDecToHex(value)),
      );
      await ZkCertificateRegistry.processNextOperation(
        leafIndices[j],
        leafHashes[j],
        mpjPath,
      );
      merkleTree.insertLeaves([leafHashes[j]], [leafIndices[j]]);
    }

    // now the last element should be in turn to be processed
    merkleProof = merkleTree.createProof(leafIndices[loops - 1]);
    merkleProofPath = merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    );
    await ZkCertificateRegistry.processNextOperation(
      leafIndices[loops - 1],
      leafHashes[loops - 1],
      merkleProofPath,
    );

    // we also check that the current pointer jumped correctly
    expect(await ZkCertificateRegistry.currentQueuePointer()).to.be.equal(
      loops,
    );
  });

  it('should return correct slice of merkle roots with startIndex', async function () {
    const { ZkCertificateRegistry, GuardianRegistry } =
      await loadFixture(deploy);

    // add deployer as a Guardian
    await GuardianRegistry.grantGuardianRole(deployer.address, [0, 0], 'test');

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    const leafHashes = generateRandomBytes32Array(5);
    const leafIndices = generateRandomNumberArray(5);

    // Add some certificates to build up merkle roots
    for (let i = 0; i < 5; i += 1) {
      const merkleProof = merkleTree.createProof(leafIndices[i]);
      const merkleProofPath = merkleProof.pathElements.map((value) =>
        fromHexToBytes32(fromDecToHex(value)),
      );

      await ZkCertificateRegistry.addOperationToQueue(leafHashes[i], 0);
      await ZkCertificateRegistry.processNextOperation(
        leafIndices[i],
        leafHashes[i],
        merkleProofPath,
      );
      merkleTree.insertLeaves([leafHashes[i]], [leafIndices[i]]);
    }

    // Get all merkle roots (should have initial roots + 5 new roots = 7 total)
    const allRoots = await ZkCertificateRegistry['getMerkleRoots(uint256)'](0);
    expect(allRoots.length).to.be.equal(7);

    // Test getMerkleRoots with startIndex at the last valid index
    const rootsFromLast =
      await ZkCertificateRegistry['getMerkleRoots(uint256)'](6);
    expect(rootsFromLast.length).to.be.equal(1);
    expect(rootsFromLast[0]).to.equal(allRoots[6]);

    // Test that startIndex out of bounds reverts
    await expect(
      ZkCertificateRegistry['getMerkleRoots(uint256)'](10),
    ).to.be.revertedWith('Start index out of bounds');
  });
});
