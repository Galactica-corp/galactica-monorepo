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
import { VerkleTree } from '../../lib/verkleTree';

describe.only('ZkCertificateRegistryVT', () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let treeDepth: number;
  let treeWidth: number;

  beforeEach(async () => {
    [deployer, user] = await hre.ethers.getSigners();
    treeDepth = 3;
    treeWidth = 4;
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

    const ZkCertificateRegistryVTFactory = await ethers.getContractFactory(
      'ZkCertificateRegistryVT',
      {
        libraries: {
          PoseidonT3: poseidonT3.address,
        },
      },
    );
    const ZkCertificateRegistryVT = await ZkCertificateRegistryVTFactory.deploy(
      GuardianRegistry.address,
      3,
      4,
      'Test ZkCertificateRegistryVT',
    );

    return {
      ZkCertificateRegistryVT,
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
    const { ZkCertificateRegistryVT, GuardianRegistry } =
      await loadFixture(deploy);

    const verkleTree = new VerkleTree(treeDepth, treeWidth);
    verkleTree.insertLeaves([1n, 3n, 4n], [2, 4, 9]);
    const verkleProof = verkleTree.createProof(2);

    expect (await ZkCertificateRegistryVT.validateVT(
      verkleProof.verkleProof,
      verkleProof.verkleCommitments,
      verkleProof.index,
      verkleProof.leafValue,
      verkleProof.root,
    )).to.be.equal(true);
  });
});
