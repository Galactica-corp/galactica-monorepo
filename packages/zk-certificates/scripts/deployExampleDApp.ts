/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import hre from 'hardhat';

import { deploySC } from '../lib/hardhatHelpers';

const { log } = console;

/**
 * Script to deploy the example DApp, a smart contract requiring zkKYC + age proof to airdrop tokens once to each user.
 */
async function main() {
  // parameters
  const verificationSBT = '0x7d1A6e0FC5ad5B20250B02fb735B640a4232a061';
  const ageProofZkKYC = '0x0996Dc2e822DcAa077B6D5C58DED6408bf7557b4';

  // wallets
  const [deployer] = await hre.ethers.getSigners();
  log(`Using account ${deployer.address} to deploy contracts`);
  log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  // deploying everything
  const mockDApp = await deploySC('MockDApp', true, {}, [
    verificationSBT,
    ageProofZkKYC,
  ]);
  const token1 = await deploySC(
    'contracts/mock/MockToken.sol:MockToken',
    true,
    {},
    [mockDApp.address],
  );
  const token2 = await deploySC(
    'contracts/mock/MockToken.sol:MockToken',
    true,
    {},
    [mockDApp.address],
  );

  await mockDApp.setToken1(token1.address);
  await mockDApp.setToken2(token2.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
