/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
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

  beforeEach(async () => {
    [deployer] = await hre.ethers.getSigners();
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
          PoseidonT3: poseidonT3.address,
        },
      },
    );
    const ZkCertificateRegistry = await ZkCertificateRegistryTest.deploy(
      GuardianRegistry.address,
    );

    return {
      ZkCertificateRegistry,
      GuardianRegistry,
    };
  }

  function expectEqualArrays(a1, a2) {
    const length1 = a1.length;
    const length2 = a2.length;
    expect(length1).to.be.equal(length2);
  }

  it("shouldn't initialize twice", async () => {
    const { ZkCertificateRegistry, GuardianRegistry } =
      await loadFixture(deploy);

    await expect(
      ZkCertificateRegistry.doubleInit(GuardianRegistry.address),
    ).to.be.revertedWith('Initializable: contract is not initializing');
  });

  it('should initialize values correctly', async () => {
    const { ZkCertificateRegistry } = await loadFixture(deploy);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    // Each value in the zero values array should be the same
    for (let i = 0; i < treeDepth; i++) {
      expect(await ZkCertificateRegistry.zeros(i)).to.equal(
        fromHexToBytes32(fromDecToHex(merkleTree.emptyBranchLevels[i])),
      );
    }
    expect(await ZkCertificateRegistry.merkleRootValidIndex()).to.be.equal(1);
    const merkleRoots = await ZkCertificateRegistry.getMerkleRoots();
    // normal "expect" doesn't compare arrays so we need to compare length and iterate over elements
    expectEqualArrays(merkleRoots, 
      [ fromHexToBytes32(fromDecToHex(merkleTree.root)) ],
    );
  });

  it('should insert elements', async function () {
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
    let merkleRoots = [fromHexToBytes32(fromDecToHex(merkleTree.root))];
    for (let i = 0; i < loops; i += 1) {
      // console.log(`trying to add leaf hash ${leafHashes[i]} to index ${leafIndices[i]}`);
      // add new zkCertificate and check the root
      const merkleProof = merkleTree.createProof(leafIndices[i]);
      const merkleProofPath = merkleProof.pathElements.map((value) =>
        fromHexToBytes32(fromDecToHex(value)),
      );
      await ZkCertificateRegistry.addZkCertificate(
        leafIndices[i],
        leafHashes[i],
        merkleProofPath,
      );
      merkleTree.insertLeaves([leafHashes[i]], [leafIndices[i]]);

      // Check roots match
      expect(await ZkCertificateRegistry.merkleRoot()).to.equal(
        fromHexToBytes32(fromDecToHex(merkleTree.root)),
      );
      merkleRoots.push(fromHexToBytes32(fromDecToHex(merkleTree.root)));
    }

    // check the merkle root array is correctly set
    const merkleRootsFromContract = await ZkCertificateRegistry.getMerkleRoots();
    expectEqualArrays(merkleRootsFromContract, merkleRoots);
    expect(await ZkCertificateRegistry.merkleRootValidIndex()).to.be.equal(1);
    for (let i = 0; i < merkleRoots.length; i++) {
      expect(await ZkCertificateRegistry.merkleRootIndex(merkleRoots[i])).to.be.equal(i);
    }

    for (let i = 0; i < leafHashes.length; i++) {
      expect(await ZkCertificateRegistry.hashToMerkleRootIndex(leafHashes[i])).to.be.equal(i+1);
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
      console.log(
        `trying to add leaf hash ${leafHashes[i]} to index ${leafIndices[i]}`,
      );

      // add new zkKYCRecord
      const merkleProof = merkleTree.createProof(leafIndices[i]);
      const merkleProofPath = merkleProof.pathElements.map((value) =>
        fromHexToBytes32(fromDecToHex(value)),
      );
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
    await ZkCertificateRegistry.revokeZkCertificate(
      leafIndices[leafIndex],
      leafHashes[leafIndex],
      merkleProofPath,
    );
    merkleTree.insertLeaves([merkleTree.emptyLeaf], [leafIndices[leafIndex]]);

    // Check roots match
    expect(await ZkCertificateRegistry.merkleRoot()).to.equal(
      fromHexToBytes32(fromDecToHex(merkleTree.root)),
    );

    expect(await ZkCertificateRegistry.merkleRootValidIndex()).to.be.equal(leafIndex + 1);
  });

  it('only Guardian can add leaf', async function () {
    const { ZkCertificateRegistry } = await loadFixture(deploy);

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
      ZkCertificateRegistry.addZkCertificate(
        leafIndices[0],
        leafHashes[0],
        merkleProofPath,
      ),
    ).to.be.revertedWith('ZkCertificateRegistry: not a Guardian');
  });
});
