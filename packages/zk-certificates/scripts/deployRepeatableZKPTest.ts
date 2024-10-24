/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import hre from 'hardhat';

import { deployRepeatableZKPTest } from './deploymentSteps/repeatableZKPTest';

/**
 * Script to deploy the example DApp, a smart contract requiring zkKYC to issue a verification SBT, repeatably.
 */
async function main() {
  // parameters
  const zkKYCRegistry = '0x68272A56A0e9b095E5606fDD8b6c297702C0dfe5';
  const verificationSBT = {
    uri: 'ipfs://QmVG5b34f8DHGnPZQwi1GD4NUXEVhh7bTub5SG6MPHvHz6',
    name: 'Repeatable KYC Verification SBT',
    symbol: 'KYCREP',
  };

  // wallets
  const [deployer] = await hre.ethers.getSigners();

  await deployRepeatableZKPTest(deployer, zkKYCRegistry, verificationSBT);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
