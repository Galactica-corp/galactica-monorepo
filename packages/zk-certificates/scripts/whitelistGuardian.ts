/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';

import { whitelistGuardian } from './deploymentSteps/whitelistGuardian';

/**
 * Script for adding a KYC center to the KYC center registry.
 */
async function main() {
  // parameters
  const [deployer] = await ethers.getSigners();
  const centerRegistryAddr = '0xeF1D3A76AC69bc8861f18d41Ef10D2C74A646cA6';
  const guardian = deployer;
  const guardianName = 'Galactica Test Guardian';

  await whitelistGuardian(deployer, centerRegistryAddr, guardian, guardianName);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
