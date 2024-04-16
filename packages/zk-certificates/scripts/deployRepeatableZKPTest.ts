/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import hre from 'hardhat';

import { deployRepeatableZKPTest } from './deploymentSteps/repeatableZKPTest';

/**
 * Script to deploy the example DApp, a smart contract requiring zkKYC to issue a verification SBT, repeatably.
 */
async function main() {
  // parameters
  const verificationSBT = '0x9EA4559bf6d41237dc89A8e78691C4Ea0c2E8eB6';
  const zkKYCRegistry = '0xD95efF72F06079DEcE33b18B165fc3A7a4bdc1fD';

  // wallets
  const [deployer] = await hre.ethers.getSigners();

  await deployRepeatableZKPTest(deployer, verificationSBT, zkKYCRegistry);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
