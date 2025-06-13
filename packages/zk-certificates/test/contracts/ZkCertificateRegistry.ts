/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { buildEddsa, poseidonContract } from 'circomlibjs';
import hre, { ethers } from 'hardhat';

import {
  fromDecToHex,
  fromHexToBytes32,
  generateRandomBytes32Array,
  generateRandomNumberArray,
  overwriteArtifact,
} from '../../lib/helpers';
import { SparseMerkleTree } from '../../lib/sparseMerkleTree';

describe('ZkCertificateRegistry', () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    [deployer, user] = await hre.ethers.getSigners();
  });

  /**
   * Deploy fixtures to work with the same setup in an efficient way.
   * @returns Fixtures.
   */
  async function deploy() {
    await overwriteArtifact(hre, 'PoseidonT3', poseidonContract.createCode(2));

    const PoseidonT3 = await ethers.getContractFactory('PoseidonT3');
    const poseidonT3 = await PoseidonT3.deploy();

    const GuardianRegistryFactory =
      await ethers.getContractFactory('GuardianRegistry');
    const GuardianRegistry = await GuardianRegistryFactory.deploy(
      'Test Guardian Registry',
    );

    const ZkCertificateRegistryTest = await ethers.getContractFactory(
      'ZkCertificateRegistryTest',
      {
        libraries: {
          PoseidonT3: await poseidonT3.getAddress(),
        },
      },
    );
    const ZkCertificateRegistry = await ZkCertificateRegistryTest.deploy(
      await GuardianRegistry.getAddress(),
      32,
    );

    return {
      ZkCertificateRegistry,
      GuardianRegistry,
    };
  }

  /**
   * Tests the equality of two arrays.
   * @param a1 - The first array to compare.
   * @param a2 - The second array to compare.
   */
  function expectEqualArrays(a1: any[], a2: any[]) {
    const length1 = a1.length;
    const length2 = a2.length;
    expect(length1).to.be.equal(length2);
  }

  it("shouldn't initialize twice", async () => {
    const { ZkCertificateRegistry, GuardianRegistry } =
      await loadFixture(deploy);

    await expect(
      ZkCertificateRegistry.doubleInit(await GuardianRegistry.getAddress()),
    ).to.be.revertedWithCustomError(
      ZkCertificateRegistry,
      'NotInitializing',
    );
  });

  it('should initialize values correctly', async () => {
    const { ZkCertificateRegistry } = await loadFixture(deploy);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    expect(await ZkCertificateRegistry.merkleRootValidIndex()).to.be.equal(1);
    const merkleRoots = await ZkCertificateRegistry.getMerkleRoots();
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
      await ZkCertificateRegistry.registerToQueue(leafHashes[i]);
      expect(
        await ZkCertificateRegistry.ZkCertificateHashToIndexInQueue(
          leafHashes[i],
        ),
      ).to.be.equal(i);
      expect(await ZkCertificateRegistry.currentQueuePointer()).to.be.equal(i);
      expect(
        await ZkCertificateRegistry.checkZkCertificateHashInQueue(
          leafHashes[i],
        ),
      ).to.be.equal(true);

      await ZkCertificateRegistry.addZkCertificate(
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
      await ZkCertificateRegistry.getMerkleRoots();
    expectEqualArrays(merkleRootsFromContract, merkleRoots);
    expect(await ZkCertificateRegistry.merkleRootValidIndex()).to.be.equal(1);
    for (let i = 0; i < merkleRoots.length; i++) {
      expect(
        await ZkCertificateRegistry.merkleRootIndex(merkleRoots[i]),
      ).to.be.equal(i);
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
      await ZkCertificateRegistry.registerToQueue(leafHashes[i]);
      await ZkCertificateRegistry.addZkCertificate(
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
    await ZkCertificateRegistry.registerToQueue(leafHashes[leafIndex]);
    expect(
      await ZkCertificateRegistry.ZkCertificateHashToIndexInQueue(
        leafHashes[leafIndex],
      ),
    ).to.be.equal(loops);
    expect(await ZkCertificateRegistry.currentQueuePointer()).to.be.equal(
      loops,
    );
    expect(
      await ZkCertificateRegistry.checkZkCertificateHashInQueue(
        leafHashes[leafIndex],
      ),
    ).to.be.equal(true);

    await ZkCertificateRegistry.revokeZkCertificate(
      leafIndices[leafIndex],
      leafHashes[leafIndex],
      merkleProofPath,
    );
    expect(await ZkCertificateRegistry.currentQueuePointer()).to.be.equal(
      loops + 1,
    );

    merkleTree.insertLeaves([merkleTree.emptyLeaf], [leafIndices[leafIndex]]);

    // Check roots match
    expect(await ZkCertificateRegistry.merkleRoot()).to.equal(
      fromHexToBytes32(fromDecToHex(merkleTree.root)),
    );

    expect(await ZkCertificateRegistry.merkleRootValidIndex()).to.be.equal(
      loops + 1,
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
      ZkCertificateRegistry.registerToQueue(leafHashes[0]),
    ).to.be.revertedWith('ZkCertificateRegistry: not a Guardian');

    // add deployer as a Guardian
    await GuardianRegistry.grantGuardianRole(deployer.address, [0, 0], 'test');

    // now the deployer can register to the queue
    await ZkCertificateRegistry.registerToQueue(leafHashes[0]);

    // but a random user cannot add ZkCertificate, even if it's already in the queue
    await expect(
      ZkCertificateRegistry.connect(user).addZkCertificate(
        leafIndices[0],
        leafHashes[0],
        merkleProofPath,
      ),
    ).to.be.revertedWith('ZkCertificateRegistry: not a Guardian');
  });

  it('elements in the queue cannot be skipped before expiration time', async function () {
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
    // we register the ZkCertificateHashes to the queue but add them yet
    for (let i = 0; i < loops; i += 1) {
      await ZkCertificateRegistry.registerToQueue(leafHashes[i]);
    }

    const queueExpirationTime = Number(
      await ZkCertificateRegistry.queueExpirationTime(),
    );

    // we check that the expiration time is set correctly
    for (let i = 1; i < loops; i += 1) {
      const expirationTime1 =
        await ZkCertificateRegistry.ZkCertificateHashToQueueTime(
          leafHashes[i - 1],
        );
      const expirationTime2 =
        await ZkCertificateRegistry.ZkCertificateHashToQueueTime(leafHashes[i]);
      expect(expirationTime2 - expirationTime1).to.be.equal(
        queueExpirationTime,
      );
    }
    // we don't intend to add the first (loops - 1) so we need to make a merkle proof without them
    merkleTree.insertLeaves([leafHashes[loops - 1]], [leafIndices[loops - 1]]);

    let merkleProof = merkleTree.createProof(leafIndices[loops - 1]);
    let merkleProofPath = merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    );

    await expect(
      ZkCertificateRegistry.addZkCertificate(
        leafIndices[loops - 1],
        leafHashes[loops - 1],
        merkleProofPath,
      ),
    ).to.be.revertedWith('ZkCertificateRegistry: zkCertificate is not in turn');

    // now we forward the time to make all earlier elements in the queue expire
    const timestamp = await ZkCertificateRegistry.ZkCertificateHashToQueueTime(
      leafHashes[loops - 2],
    );
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      Number(timestamp),
    ]);
    await hre.network.provider.send('evm_mine');
    await ZkCertificateRegistry.addZkCertificate(
      leafIndices[loops - 1],
      leafHashes[loops - 1],
      merkleProofPath,
    );
    // we also check that the current pointer jumped correctly
    expect(await ZkCertificateRegistry.currentQueuePointer()).to.be.equal(
      loops,
    );
    // since we reached the end of the queue we can also check that if we add another element the expiration time will not be dependent on earlier elements
    const tx = await ZkCertificateRegistry.registerToQueue(leafHashes[0]);
    merkleTree.insertLeaves([leafHashes[0]], [leafIndices[0]]);

    merkleProof = merkleTree.createProof(leafIndices[loops - 1]);
    merkleProofPath = merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    );
    const { blockNumber } = tx;
    if (!blockNumber) {
      throw new Error('Block number is null');
    }
    const txBlock = await ethers.provider.getBlock(blockNumber);
    if (!txBlock) {
      throw new Error('Block is null');
    }
    const blocktime = Number(txBlock.timestamp);
    expect(
      await ZkCertificateRegistry.ZkCertificateHashToQueueTime(leafHashes[0]),
    ).to.be.equal(blocktime + queueExpirationTime);
  });
});
