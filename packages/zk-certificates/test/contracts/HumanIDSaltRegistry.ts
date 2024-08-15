/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { buildEddsa } from 'circomlibjs';
import hre, { ethers } from 'hardhat';


describe.only('HumanIDSaltRegistry', () => {

  beforeEach(async () => {
  });

  /**
   * Deploy fixtures to work with the same setup in an efficient way.
   * @returns Fixtures.
   */
  async function deploy() {
    const [deployer, zkKYCRegistryMock] = await hre.ethers.getSigners();

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
    );

    return {
      deployer,
      zkKYCRegistryMock,
      guardianRegistry,
      humanIDSaltRegistry,
    };
  }

  it('should initialize values correctly', async () => {
    const { guardianRegistry, humanIDSaltRegistry, zkKYCRegistryMock } = await loadFixture(deploy);

    expect(await humanIDSaltRegistry.guardianRegistry()).to.be.equal(guardianRegistry.address);
    expect(await humanIDSaltRegistry.zkCertRegistry()).to.be.equal(zkKYCRegistryMock.address);
  });
});
