/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { buildEddsa } from 'circomlibjs';
import hre, { ethers } from 'hardhat';
import { HumanIDSaltRegistry, SaltLockingZkCertStruct } from '../../typechain-types/contracts/HumanIDSaltRegistry';
import { BigNumber } from 'ethers';
import {
  generateSampleZkKYC,
} from '../../scripts/generateZkKYCInput';
import { getIdHash } from '../../lib/zkKYC';


describe.only('HumanIDSaltRegistry', () => {


  /**
   * Deploy fixtures to work with the same setup in an efficient way.
   * @returns Fixtures.
   */
  async function deploy() {
    const [deployer, zkKYCRegistryMock, guardian] = await hre.ethers.getSigners();

    const guardianRegistryFactory =
      await ethers.getContractFactory('GuardianRegistry');
    const guardianRegistry = await guardianRegistryFactory.deploy(
      'Test Guardian Registry',
    );

    const humanIDSaltRegistryFactory =
      await ethers.getContractFactory('HumanIDSaltRegistry');
    const humanIDSaltRegistry = await humanIDSaltRegistryFactory.deploy(
      guardianRegistry.address,
      zkKYCRegistryMock.address,
    ) as HumanIDSaltRegistry;

    const zkKYC = await generateSampleZkKYC();
    const exampleSaltLockingZkCert: SaltLockingZkCertStruct = {
      zkCertId: zkKYC.leafHash,
      guardian: guardian.address,
      expirationTime: zkKYC.expirationDate,
      revoked: false,
    };

    return {
      deployer,
      zkKYCRegistryMock,
      guardian,
      guardianRegistry,
      humanIDSaltRegistry,
      example: {
        saltLockingZkCert: exampleSaltLockingZkCert,
        idHash: getIdHash(zkKYC),
        saltHash: zkKYC.holderCommitment,
      },
    };
  }

  it('should initialize values correctly', async () => {
    const { guardianRegistry, humanIDSaltRegistry, zkKYCRegistryMock } = await loadFixture(deploy);

    expect(await humanIDSaltRegistry.guardianRegistry()).to.be.equal(guardianRegistry.address);
    expect(await humanIDSaltRegistry.zkCertRegistry()).to.be.equal(zkKYCRegistryMock.address);
  });

  describe('zkCertIssuance', () => {
    it('should register new salt', async () => {
      const { zkKYCRegistryMock, humanIDSaltRegistry, example } = await loadFixture(deploy);
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, example.saltHash);
      // this test should pass without reverting
    });

    it('should accept new zkKYC with existing salt', async () => {
      const { zkKYCRegistryMock, humanIDSaltRegistry, example, guardian } = await loadFixture(deploy);
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, example.saltHash);

      const otherZkKYC = await generateSampleZkKYC();
      otherZkKYC.expirationDate = 1000;
      const otherSaltLockingZkCert: SaltLockingZkCertStruct = {
        zkCertId: otherZkKYC.leafHash,
        guardian: guardian.address,
        expirationTime: otherZkKYC.expirationDate,
        revoked: false,
      };
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(otherSaltLockingZkCert, getIdHash(otherZkKYC), otherZkKYC.holderCommitment);
      // this test should pass without reverting
    });

    it('should revert when not called by registry', async () => {
      const { deployer, humanIDSaltRegistry, example } = await loadFixture(deploy);
      const call = humanIDSaltRegistry.connect(deployer).onZkCertIssuance(example.saltLockingZkCert, example.idHash, example.saltHash);
      await expect(call).to.be.revertedWith('HumanIDSaltRegistry: only zkCertRegistry can call this function');
    });

    it('should revert when another salt is registered', async () => {
      const { zkKYCRegistryMock, humanIDSaltRegistry, example, guardian } = await loadFixture(deploy);
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, example.saltHash);

      const wrongSaltHash = 666;
      const call = humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, wrongSaltHash);
      await expect(call).to.be.revertedWith('HumanIDSaltRegistry: salt hash does not match the registered one');
    });
  });

  describe('zkCertRevocation', () => {
  });

  describe('Reset salt', () => {
  });
});
