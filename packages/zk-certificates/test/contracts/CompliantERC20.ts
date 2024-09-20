/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import chai from 'chai';
import { parseEther } from 'ethers/lib/utils';
import hre, { ethers } from 'hardhat';

import type { CompliantERC20 } from '../../typechain-types/contracts/CompliantERC20';
import type { VerificationSBT } from '../../typechain-types/contracts/VerificationSBT';

chai.config.includeStack = true;
const { expect } = chai;

describe('CompliantERC20', () => {
  /**
   * Deploy fixtures to work with the same setup in an efficient way.
   * @returns Fixtures.
   */
  async function deploy() {
    const [deployer, compliantUser, nonCompliantUser] =
      await hre.ethers.getSigners();
    const params = {
      name: 'Compliant ERC20',
      symbol: 'CERC20',
      initialSupply: parseEther('1000000'),
    };

    const verificationSBTFactory = await ethers.getContractFactory(
      'VerificationSBT',
      deployer,
    );
    const verificationSBT = (await verificationSBTFactory.deploy(
      'test URI',
      'VerificationSBT',
      'VerificationSBT',
    )) as VerificationSBT;

    const mockZkKYCFactory = await ethers.getContractFactory(
      'MockZkKYC',
      deployer,
    );
    const mockZkKYC = await mockZkKYCFactory.deploy();

    // setup contracts
    const tokenFactory = await ethers.getContractFactory(
      'CompliantERC20',
      deployer,
    );
    const token = (await tokenFactory.deploy(
      params.name,
      params.symbol,
      deployer.address,
      params.initialSupply,
      verificationSBT.address,
      [mockZkKYC.address],
    )) as CompliantERC20;

    // compliantUser passes KYC requirements
    const expirationTime = Math.floor(Date.now() / 1000) * 2;
    await mockZkKYC
      .connect(compliantUser)
      .earnVerificationSBT(
        verificationSBT.address,
        expirationTime,
        [],
        [0, 0],
        ethers.utils.hexZeroPad('0x1', 32),
        [3, 4],
      );

    return {
      token,
      params,
      acc: {
        deployer,
        compliantUser,
        nonCompliantUser,
      },
      verificationSBT,
      mockZkKYC,
    };
  }

  it('should deploy with right params', async () => {
    const { token, params, acc, verificationSBT, mockZkKYC } =
      await loadFixture(deploy);

    expect(await token.name()).to.equal(params.name);
    expect(await token.symbol()).to.equal(params.symbol);
    expect(await token.totalSupply()).to.equal(params.initialSupply);
    expect(await token.balanceOf(acc.deployer.address)).to.equal(
      params.initialSupply,
    );
    expect(await token.owner()).to.equal(acc.deployer.address);

    expect(await token.verificationSBT()).to.equal(verificationSBT.address);
    expect(await token.compliancyRequirements(0)).to.equal(mockZkKYC.address);
  });

  it('should transfer to compliant user', async () => {
    const { token, acc, params } = await loadFixture(deploy);
    const amount = parseEther('100');

    await token.transfer(acc.compliantUser.address, amount);

    expect(await token.balanceOf(acc.compliantUser.address)).to.equal(amount);
    expect(await token.balanceOf(acc.deployer.address)).to.equal(
      params.initialSupply.sub(amount),
    );
  });

  it('should fail transferring to non-compliant user', async () => {
    const { token, acc } = await loadFixture(deploy);
    const amount = parseEther('100');

    await expect(
      token.transfer(acc.nonCompliantUser.address, amount),
    ).to.be.revertedWith(
      'CompliantERC20: Recipient does not have required compliance SBTs.',
    );
  });

  it('should update compliance requirements', async () => {
    const { token, acc } = await loadFixture(deploy);

    const newComplianceRequirements = [
      await ethers.Wallet.createRandom().getAddress(),
      await ethers.Wallet.createRandom().getAddress(),
    ];
    await expect(
      token
        .connect(acc.nonCompliantUser)
        .setCompliancyRequirements(newComplianceRequirements),
    ).to.be.revertedWith('Ownable: caller is not the owner');

    await token
      .connect(acc.deployer)
      .setCompliancyRequirements(newComplianceRequirements);

    expect(await token.compliancyRequirements(0)).to.equal(
      newComplianceRequirements[0],
    );
    expect(await token.compliancyRequirements(1)).to.equal(
      newComplianceRequirements[1],
    );

    // the previous user should not be compliant anymore
    await expect(
      token.transfer(acc.nonCompliantUser.address, parseEther('1')),
    ).to.be.revertedWith(
      'CompliantERC20: Recipient does not have required compliance SBTs.',
    );
  });
});
