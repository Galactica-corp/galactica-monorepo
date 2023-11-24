/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import hre from 'hardhat';

import { deployBasicKYCExampleDApp } from './deploymentSteps/basicKYCExampleDApp';

/**
 * Script to deploy the example DApp, a smart contract requiring zkKYC to issue a verification SBT.
 */
async function main() {
  // parameters
  const verificationSBT = '0x7d1A6e0FC5ad5B20250B02fb735B640a4232a061';
  const zkKYC = '0x86aCd7EC220583eEcDC10b50535b37FD77133E8D'; // you can reuse the zkKYC smart contract from the deployment of the RepeatableZKPTest

  // wallets
  const [deployer] = await hre.ethers.getSigners();

  // deploying everything
  await deployBasicKYCExampleDApp(deployer, verificationSBT, zkKYC);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
