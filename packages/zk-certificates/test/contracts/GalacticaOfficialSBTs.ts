/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import hre, { ethers } from 'hardhat';

import type { GalacticaOfficialSBT } from '../../typechain-types/contracts/GalacticaOfficialSBT';

use(chaiAsPromised);

chai.config.includeStack = true;

describe.only('Galactica Official SBT Smart contract', () => {
  let GalacticaOfficialSBT: GalacticaOfficialSBT;
  let baseURI: string = "https://galactica.network/sbt/";
  let name: string = "Galactica Official SBT";
  let symbol: string = "GO SBT";
  let deployer: SignerWithAddress;
  let issuer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    // reset the testing chain so we can perform time related tests
    await hre.network.provider.send('hardhat_reset');

    [deployer, issuer, user] = await ethers.getSigners();

    const GalacticaOfficialSBTFactory = await ethers.getContractFactory('GalacticaOfficialSBT');
    GalacticaOfficialSBT = await GalacticaOfficialSBTFactory.deploy(
      issuer.address,
      baseURI,
      deployer.address,
      name,
      symbol,
    );
  });

  it('check that initial parameters, authorization is set correctly', async () => {
    expect(await GalacticaOfficialSBT.baseURI()).to.equal(baseURI);
    expect(await GalacticaOfficialSBT.tokenNextIndex()).to.equal(0);

    const newBaseURI = "new test URI";
    await expect(GalacticaOfficialSBT.connect(issuer).changeBaseURI(newBaseURI)).to.be.reverted;
    await GalacticaOfficialSBT.changeBaseURI(newBaseURI);
    expect(await GalacticaOfficialSBT.baseURI()).to.equal(newBaseURI);
  });
});
