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

describe('KYCRecordRegistry', () => {
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
    const GuardianRegistry = await GuardianRegistryFactory.deploy();

    const KYCRecordRegistryTest = await ethers.getContractFactory(
      'KYCRecordRegistryTest',
      {
        libraries: {
          PoseidonT3: poseidonT3.address,
        },
      },
    );
    const KYCRecordRegistry = await KYCRecordRegistryTest.deploy(
      GuardianRegistry.address,
    );

    return {
      KYCRecordRegistry,
      GuardianRegistry,
    };
  }

  it("shouldn't initialize twice", async () => {
    const { KYCRecordRegistry, GuardianRegistry } = await loadFixture(deploy);

    await expect(
      KYCRecordRegistry.doubleInit(GuardianRegistry.address),
    ).to.be.revertedWith('Initializable: contract is not initializing');
  });

  it('should calculate zero values', async () => {
    const { KYCRecordRegistry } = await loadFixture(deploy);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    // Each value in the zero values array should be the same
    for (let i = 0; i < treeDepth; i++) {
      expect(await KYCRecordRegistry.zeros(i)).to.equal(
        fromHexToBytes32(fromDecToHex(merkleTree.emptyBranchLevels[i])),
      );
    }
  });

  it('should calculate empty root', async () => {
    const { KYCRecordRegistry } = await loadFixture(deploy);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    // Should initialize empty root correctly
    expect(await KYCRecordRegistry.merkleRoot()).to.equal(
      fromHexToBytes32(fromDecToHex(merkleTree.root)),
    );
  });

  it('should insert elements', async function () {
    const loops = 5;

    const { KYCRecordRegistry, GuardianRegistry } = await loadFixture(deploy);

    // add deployer as a Guardian
    await GuardianRegistry.grantGuardianRole(deployer.address, [0, 0], 'test');

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    const leafHashes = generateRandomBytes32Array(5);
    const leafIndices = generateRandomNumberArray(5);
    for (let i = 0; i < loops; i += 1) {
      // console.log(`trying to add leaf hash ${leafHashes[i]} to index ${leafIndices[i]}`);
      // add new zkKYCRecord and check the root
      const merkleProof = merkleTree.createProof(leafIndices[i]);
      const merkleProofPath = merkleProof.path.map((value) =>
        fromHexToBytes32(fromDecToHex(value)),
      );
      await KYCRecordRegistry.addZkKYCRecord(
        leafIndices[i],
        leafHashes[i],
        merkleProofPath,
      );
      merkleTree.insertLeaves([leafHashes[i]], [leafIndices[i]]);

      // Check roots match
      expect(await KYCRecordRegistry.merkleRoot()).to.equal(
        fromHexToBytes32(fromDecToHex(merkleTree.root)),
      );
    }
  });

  it('should be able to nullify a leaf', async function () {
    const loops = 5;

    const { KYCRecordRegistry, GuardianRegistry } = await loadFixture(deploy);

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
      const merkleProofPath = merkleProof.path.map((value) =>
        fromHexToBytes32(fromDecToHex(value)),
      );
      await KYCRecordRegistry.addZkKYCRecord(
        leafIndices[i],
        leafHashes[i],
        merkleProofPath,
      );
      merkleTree.insertLeaves([leafHashes[i]], [leafIndices[i]]);
    }

    // now we will try to nullify the first added leaf
    const merkleProof = merkleTree.createProof(leafIndices[0]);
    const merkleProofPath = merkleProof.path.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    );
    await KYCRecordRegistry.revokeZkKYCRecord(
      leafIndices[0],
      leafHashes[0],
      merkleProofPath,
    );
    merkleTree.insertLeaves([merkleTree.emptyLeaf], [leafIndices[0]]);

    // Check roots match
    expect(await KYCRecordRegistry.merkleRoot()).to.equal(
      fromHexToBytes32(fromDecToHex(merkleTree.root)),
    );
  });

  it('only KYC Center can add leaf', async function () {
    const { KYCRecordRegistry } = await loadFixture(deploy);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    const leafHashes = generateRandomBytes32Array(1);
    const leafIndices = generateRandomNumberArray(1);
    // add new zkKYCRecord and check the root
    const merkleProof = merkleTree.createProof(leafIndices[0]);
    const merkleProofPath = merkleProof.path.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    );
    await expect(
      KYCRecordRegistry.addZkKYCRecord(
        leafIndices[0],
        leafHashes[0],
        merkleProofPath,
      ),
    ).to.be.revertedWith('KYCRecordRegistry: not a KYC Center');
  });
});
