/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';

import { whitelistGuardian } from './deploymentSteps/whitelistGuardian';

/**
 * Script for adding a KYC center to the KYC center registry.
 */
async function main() {
  // parameters
  const [deployer, guardian] = await ethers.getSigners();
  const centerRegistryAddr = '0x20682CE367cE2cA50bD255b03fEc2bd08Cc1c8Bd';
  const guardianName = 'Galactica Test Guardian';
  const centerRegistry = await ethers.getContractAt(
    'ZkCertificateRegistry',
    centerRegistryAddr,
  );
  const adminAddress = await centerRegistry.owner();
  console.log(`admin address is ${adminAddress}`);

  /* await centerRegistry.setNewOwner(guardian.address);
  await centerRegistry.connect(guardian).transferOwnership(); */

  console.log(`guardian address is ${guardian.address}`);

  // await whitelistGuardian(deployer, centerRegistryAddr, guardian, guardianName);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
