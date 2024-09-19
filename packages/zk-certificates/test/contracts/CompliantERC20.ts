/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import chai from 'chai';
import { buildPoseidon } from 'circomlibjs';
import hre, { ethers } from 'hardhat';
import { groth16 } from 'snarkjs';

import type { Poseidon } from '../../lib';
import {
  fromDecToHex,
  fromHexToBytes32,
  hashStringToFieldNumber,
  processProof,
  processPublicSignals,
} from '../../lib/helpers';
import {
  generateSampleZkKYC,
  generateZkKYCProofInput,
} from '../../scripts/generateZkKYCInput';
import type { CompliantERC20 } from '../../typechain-types/contracts/CompliantERC20';
import { parseEther } from 'ethers/lib/utils';

chai.config.includeStack = true;
const { expect } = chai;

describe.only('CompliantERC20', () => {

  /**
   * Deploy fixtures to work with the same setup in an efficient way.
   * @returns Fixtures.
   */
  async function deploy() {
    const [deployer, compliantUser, nonCompliantUser] = await hre.ethers.getSigners();
    const params = {
      name: 'Compliant ERC20',
      symbol: 'CERC20',
      initialSupply: "1000000",
    };

    // setup contracts
    const tokenFactory = await ethers.getContractFactory(
      'CompliantERC20',
      deployer,
    );
    const token = (await tokenFactory.deploy(params.name, params.symbol, deployer.address, params.initialSupply)) as CompliantERC20;

    return {
      token,
      params,
      acc: {
        deployer,
        compliantUser,
        nonCompliantUser,
      },
    };
  }

  it('should deploy with right params', async () => {
    const { token, params, acc } = await loadFixture(deploy);

    // random user cannot change the addresses
    expect(await token.name()).to.equal(params.name);
    expect(await token.symbol()).to.equal(params.symbol);
    const supply = ethers.utils.parseUnits(params.initialSupply, "ether");
    expect(await token.totalSupply()).to.equal(supply);
    expect(await token.balanceOf(acc.deployer.address)).to.equal(supply);

    expect(await token.owner()).to.equal(acc.deployer.address);

  });
});
