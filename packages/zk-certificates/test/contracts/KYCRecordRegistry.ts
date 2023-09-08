/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { buildEddsa } from 'circomlibjs';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { SparseMerkleTree } from '../../lib/sparseMerkleTree';
const hre = require('hardhat');
import {
  overwriteArtifact,
  fromDecToHex,
  fromHexToBytes32,
  generateRandomBytes32Array,
  generateRandomNumberArray,
} from '../../lib/helpers';
import { poseidonContract } from 'circomlibjs';


describe('KYCRecordRegistry', () => {
  let deployer: SignerWithAddress;

  beforeEach(async () => {
    [deployer] = await hre.ethers.getSigners();
  });
  /**
   * Deploy fixtures
   *
   * @returns fixtures
   */
  async function deploy() {
    await overwriteArtifact(hre, 'PoseidonT3', poseidonContract.createCode(2));

    const PoseidonT3 = await ethers.getContractFactory('PoseidonT3');
    const poseidonT3 = await PoseidonT3.deploy();

    const KYCCenterRegistryFactory = await ethers.getContractFactory(
      'KYCCenterRegistry'
    );
    const KYCCenterRegistry = await KYCCenterRegistryFactory.deploy();

    const KYCRecordRegistryTest = await ethers.getContractFactory(
      'KYCRecordRegistryTest',
      {
        libraries: {
          PoseidonT3: poseidonT3.address,
        },
      }
    );
    const KYCRecordRegistry = await KYCRecordRegistryTest.deploy(
      KYCCenterRegistry.address
    );

    return {
      KYCRecordRegistry,
      KYCCenterRegistry,
    };
  }

  it("Shouldn't initialize twice", async () => {
    const { KYCRecordRegistry, KYCCenterRegistry } = await loadFixture(deploy);

    await expect(
      KYCRecordRegistry.doubleInit(KYCCenterRegistry.address)
    ).to.be.revertedWith('Initializable: contract is not initializing');
  });

  it('Should calculate zero values', async () => {
    const { KYCRecordRegistry, KYCCenterRegistry } = await loadFixture(deploy);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    // Each value in the zero values array should be the same
    for (let i = 0; i < treeDepth; i++) {
      expect(await KYCRecordRegistry.zeros(i)).to.equal(
        fromHexToBytes32(fromDecToHex(merkleTree.emptyBranchLevels[i]))
      );
    }
  });

  it('Should calculate empty root', async () => {
    const { KYCRecordRegistry, KYCCenterRegistry } = await loadFixture(deploy);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    // Should initialize empty root correctly
    expect(await KYCRecordRegistry.merkleRoot()).to.equal(
      fromHexToBytes32(fromDecToHex(merkleTree.root))
    );
  });

  it('Should insert elements', async function () {
    let loops = 5;

    const { KYCRecordRegistry, KYCCenterRegistry } = await loadFixture(deploy);

    // add deployer as a KYCCenter
    KYCCenterRegistry.grantKYCCenterRole(deployer.address);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    const leafHashes = generateRandomBytes32Array(5);
    const leafIndices = generateRandomNumberArray(5);
    for (let i = 0; i < loops; i += 1) {
      console.log(`trying to add leaf hash ${leafHashes[i]} to index ${leafIndices[i]}`);

      // add new zkKYCRecord and check the root
      let merkleProof = merkleTree.createProof(leafIndices[i]);
      let merkleProofPath = merkleProof.path.map(x => fromHexToBytes32(fromDecToHex(x)));
      await KYCRecordRegistry.addZkKYCRecord(leafIndices[i], leafHashes[i], merkleProofPath);
      merkleTree.insertLeaves([leafHashes[i]], [leafIndices[i]]);

      // Check roots match
      expect(await KYCRecordRegistry.merkleRoot()).to.equal(
        fromHexToBytes32(fromDecToHex(merkleTree.root))
      );
    }
  });

  it('Should be able to nullify a leaf', async function () {
    let loops = 5;

    const { KYCRecordRegistry, KYCCenterRegistry } = await loadFixture(deploy);

    // add deployer as a KYCCenter
    KYCCenterRegistry.grantKYCCenterRole(deployer.address);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    const leafHashes = generateRandomBytes32Array(loops);
    const leafIndices = generateRandomNumberArray(loops);
    for (let i = 0; i < loops; i += 1) {
      console.log(`trying to add leaf hash ${leafHashes[i]} to index ${leafIndices[i]}`);

      // add new zkKYCRecord 
      let merkleProof = merkleTree.createProof(leafIndices[i]);
      let merkleProofPath = merkleProof.path.map(x => fromHexToBytes32(fromDecToHex(x)));
      await KYCRecordRegistry.addZkKYCRecord(leafIndices[i], leafHashes[i], merkleProofPath);
      merkleTree.insertLeaves([leafHashes[i]], [leafIndices[i]]);
    }

    // now we will try to nullify the first added leaf
    let merkleProof = merkleTree.createProof(leafIndices[0]);
    let merkleProofPath = merkleProof.path.map(x => fromHexToBytes32(fromDecToHex(x)));
    await KYCRecordRegistry.revokeZkKYCRecord(leafIndices[0], leafHashes[0], merkleProofPath);
    merkleTree.insertLeaves([merkleTree.emptyLeaf], [leafIndices[0]]);

    // Check roots match
    expect(await KYCRecordRegistry.merkleRoot()).to.equal(
      fromHexToBytes32(fromDecToHex(merkleTree.root))
    );
  });


  it('Only KYC Center can add leaf', async function () {

    const { KYCRecordRegistry, KYCCenterRegistry } = await loadFixture(deploy);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new SparseMerkleTree(treeDepth, eddsa.poseidon);

    const leafHashes = generateRandomBytes32Array(1);
    const leafIndices = generateRandomNumberArray(1);
    // add new zkKYCRecord and check the root
    let merkleProof = merkleTree.createProof(leafIndices[0]);
    let merkleProofPath = merkleProof.path.map(x => fromHexToBytes32(fromDecToHex(x)));
    await expect(KYCRecordRegistry.addZkKYCRecord(leafIndices[0], leafHashes[0], merkleProofPath)).to.be.revertedWith("KYCRecordRegistry: not a KYC Center");
  });
});
