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
    await guardianRegistry.grantGuardianRole(guardian.address, [0, 0], "https://test.com");

    const humanIDSaltRegistryFactory =
      await ethers.getContractFactory('HumanIDSaltRegistry');
    const humanIDSaltRegistry = await humanIDSaltRegistryFactory.deploy(
      guardianRegistry.address,
      zkKYCRegistryMock.address,
    ) as HumanIDSaltRegistry;

    const zkKYC = await generateSampleZkKYC();
    zkKYC.expirationDate = (await hre.ethers.provider.getBlock('latest')).timestamp + 1000;
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
        zkKYC,
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
      // set another expiration date to get another zkCert hash
      otherZkKYC.expirationDate = example.zkKYC.expirationDate + 2;
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
      const { zkKYCRegistryMock, humanIDSaltRegistry, example } = await loadFixture(deploy);
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, example.saltHash);

      const wrongSaltHash = 666;
      const call = humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, wrongSaltHash);
      await expect(call).to.be.revertedWith('HumanIDSaltRegistry: salt hash does not match the registered one');
    });
  });

  describe('zkCertRevocation', () => {
    it('should revoke zkCert', async () => {
      const { zkKYCRegistryMock, humanIDSaltRegistry, example } = await loadFixture(deploy);
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, example.saltHash);
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertRevocation(example.zkKYC.leafHash);
      // this test should pass without reverting
    });

    it('should revert when not called by registry', async () => {
      const { zkKYCRegistryMock, humanIDSaltRegistry, example, deployer } = await loadFixture(deploy);
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, example.saltHash);

      const call = humanIDSaltRegistry.connect(deployer).onZkCertRevocation(example.zkKYC.leafHash);
      await expect(call).to.be.revertedWith('HumanIDSaltRegistry: only zkCertRegistry can call this function');
    });
  });

  describe('Reset salt', () => {
    it('should reset salt with one expired and one revoked zkKYC', async () => {
      const { zkKYCRegistryMock, humanIDSaltRegistry, example, guardian } = await loadFixture(deploy);

      // register two zkKYCs
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, example.saltHash);

      const otherZkKYC = await generateSampleZkKYC();
      otherZkKYC.expirationDate = example.zkKYC.expirationDate - 100;
      const otherSaltLockingZkCert: SaltLockingZkCertStruct = {
        zkCertId: otherZkKYC.leafHash,
        guardian: guardian.address,
        expirationTime: otherZkKYC.expirationDate,
        revoked: false,
      };
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(otherSaltLockingZkCert, getIdHash(otherZkKYC), otherZkKYC.holderCommitment);

      // revoke the first one
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertRevocation(example.zkKYC.leafHash);
      // let the second one expire
      await hre.network.provider.send('evm_setNextBlockTimestamp', [otherZkKYC.expirationDate + 2]);
      await hre.network.provider.send('evm_mine');

      // before resetting the salt, the zkKYC should not accept another salt
      const newSalt = 666;
      const call = humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, newSalt);
      await expect(call).to.be.revertedWith('HumanIDSaltRegistry: salt hash does not match the registered one');

      // reset the salt
      await humanIDSaltRegistry.connect(guardian).resetSalt(example.idHash);

      // after the salt has been reset, the zkKYC should accept another salt
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, newSalt);
    });

    it('should revert if called by a not whitelisted guardian', async () => {
      const { humanIDSaltRegistry, example, deployer } = await loadFixture(deploy);
      const call = humanIDSaltRegistry.connect(deployer).resetSalt(example.idHash);
      await expect(call).to.be.revertedWith('HumanIDSaltRegistry: only whitelisted guardians can call this function');
    });

    it('should return list of active zkKYCs blocking a reset', async () => {
      const { zkKYCRegistryMock, humanIDSaltRegistry, example, guardian } = await loadFixture(deploy);

      // register three zkKYCs: an expired one, an active one and a revoked one
      const expiredZkKYC = await generateSampleZkKYC();
      expiredZkKYC.expirationDate = example.zkKYC.expirationDate - 100;
      const expiredSaltLockingZkCert: SaltLockingZkCertStruct = {
        zkCertId: expiredZkKYC.leafHash,
        guardian: guardian.address,
        expirationTime: expiredZkKYC.expirationDate,
        revoked: false,
      };
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(expiredSaltLockingZkCert, getIdHash(expiredZkKYC), expiredZkKYC.holderCommitment);
      // let it expire
      await hre.network.provider.send('evm_setNextBlockTimestamp', [expiredZkKYC.expirationDate + 2]);
      await hre.network.provider.send('evm_mine');

      // register the active one
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(example.saltLockingZkCert, example.idHash, example.saltHash);

      // register the revoked one
      const revokedZkKYC = await generateSampleZkKYC();
      revokedZkKYC.expirationDate = example.zkKYC.expirationDate + 1000;
      const revokedSaltLockingZkCert: SaltLockingZkCertStruct = {
        zkCertId: revokedZkKYC.leafHash,
        guardian: guardian.address,
        expirationTime: revokedZkKYC.expirationDate,
        revoked: false,
      };
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertIssuance(revokedSaltLockingZkCert, getIdHash(revokedZkKYC), revokedZkKYC.holderCommitment);
      await humanIDSaltRegistry.connect(zkKYCRegistryMock).onZkCertRevocation(revokedZkKYC.leafHash);

      // the reset should return the only active zkKYC
      const activeZkKYCs = await humanIDSaltRegistry.connect(guardian).callStatic.resetSalt(example.idHash);
      expect(activeZkKYCs.length).to.equal(1);
      expect(activeZkKYCs[0].zkCertId).to.equal(example.zkKYC.leafHash);
      expect(activeZkKYCs[0].guardian).to.equal(guardian.address);
      expect(activeZkKYCs[0].expirationTime).to.equal(example.zkKYC.expirationDate);
      expect(activeZkKYCs[0].revoked).to.be.false;
    });
  });

  // TODO: handle guardians who have been removed from the registry
});
