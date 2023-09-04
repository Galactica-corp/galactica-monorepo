/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { buildEddsa } from 'circomlibjs';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { MerkleTree } from '../../lib/merkleTree';
const hre = require('hardhat');
import {
  overwriteArtifact,
  fromDecToHex,
  fromHexToBytes32,
  generateRandomBytes32Array,
  arrayToBigInt,
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
    const merkleTree = new MerkleTree(treeDepth, eddsa.poseidon);

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
    const merkleTree = new MerkleTree(treeDepth, eddsa.poseidon);

    // Should initialize empty root correctly
    expect(await KYCRecordRegistry.merkleRoot()).to.equal(
      fromHexToBytes32(fromDecToHex(merkleTree.root))
    );
  });

  it('Should incrementally insert elements', async function () {
    let loops = 5;

    const { KYCRecordRegistry, KYCCenterRegistry } = await loadFixture(deploy);

    // add deployer as a KYCCenter
    KYCCenterRegistry.grantKYCCenterRole(deployer.address);

    const eddsa = await buildEddsa();
    const treeDepth = 32;
    const merkleTree = new MerkleTree(treeDepth, eddsa.poseidon);

    const insertList = [];
    for (let i = 0; i < loops; i += 1) {
      // Check the insertion numbers
      expect(
        await KYCRecordRegistry.getInsertionTreeNumberAndStartingIndex(
          insertList.length
        )
      ).to.deep.equal([0, merkleTree.tree[0].length]);

      // Update with insert list on local and contract
      await KYCRecordRegistry.insertLeavesTest(insertList);
      merkleTree.insertLeaves(insertList);

      // Check roots match
      expect(await KYCRecordRegistry.merkleRoot()).to.equal(
        fromHexToBytes32(fromDecToHex(merkleTree.root))
      );

      // Check tree length matches
      expect(await KYCRecordRegistry.nextLeafIndex()).to.equal(
        merkleTree.tree[0].length
      );

      // Add another element to insert list
      insertList.push(
        fromHexToBytes32(
          arrayToBigInt(generateRandomBytes32Array(1)[0]).toString(16)
        )
      );
    }
  });

  it('Should roll over to new tree', async function () {
    const { KYCRecordRegistry, KYCCenterRegistry } = await loadFixture(deploy);

    // add deployer as a KYCCenter
    KYCCenterRegistry.grantKYCCenterRole(deployer.address);
    // Check tree number is 0
    expect(await KYCRecordRegistry.treeNumber()).to.equal(0);

    // Set next leaf index to one less than filled tree
    const treeDepth = 32;
    await KYCRecordRegistry.setNextLeafIndex(2 ** treeDepth - 2);

    // Check the insertion numbers
    expect(
      await KYCRecordRegistry.getInsertionTreeNumberAndStartingIndex(1)
    ).to.deep.equal([0, 2 ** treeDepth - 2]);

    // Insert leaf hash
    await KYCRecordRegistry.insertLeavesTest(generateRandomBytes32Array(1));

    // Check the insertion numbers
    expect(
      await KYCRecordRegistry.getInsertionTreeNumberAndStartingIndex(1)
    ).to.deep.equal([0, 2 ** treeDepth - 1]);

    // Check tree number is 0
    expect(await KYCRecordRegistry.treeNumber()).to.equal(0);

    // Insert leaf hash
    await KYCRecordRegistry.insertLeavesTest(generateRandomBytes32Array(1));

    // Check the insertion numbers
    expect(
      await KYCRecordRegistry.getInsertionTreeNumberAndStartingIndex(1)
    ).to.deep.equal([1, 0]);

    // Insert leaf hash
    await KYCRecordRegistry.insertLeavesTest(generateRandomBytes32Array(1));

    // Check tree number is 1
    expect(await KYCRecordRegistry.treeNumber()).to.equal(1);
  });

  it('Only KYC Center can add leaf', async function () {
    const { KYCRecordRegistry, KYCCenterRegistry } = await loadFixture(deploy);

    const leafHash = fromHexToBytes32(
      arrayToBigInt(generateRandomBytes32Array(1)[0]).toString(16)
    );

    await expect(
      KYCRecordRegistry.connect(deployer).addZkKYCRecord(leafHash)
    ).to.be.revertedWith('KYCRecordRegistry: not a KYC Center');

    // add deployer as a KYCCenter
    KYCCenterRegistry.grantKYCCenterRole(deployer.address);

    await expect(KYCRecordRegistry.connect(deployer).addZkKYCRecord(leafHash))
      .to.emit(KYCRecordRegistry, 'zkKYCRecordAddition')
      .withArgs(leafHash, deployer.address);
  });
});
