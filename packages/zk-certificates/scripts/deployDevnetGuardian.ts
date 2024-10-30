/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import hre from 'hardhat';

import { deployDevnetGuardian } from './deploymentSteps/devnetGuardian';

/**
 * Deploys a simple contract that everyone can use to test issuing zkKYCs without having to be whitelisted as guardians first.
 * Meant for the devnet.
 */
async function main() {
  // parameters
  const guardianRegistryAddr = '0x3D8AAba820817254719BD6f997835B6f9F3485e2';
  const recordRegistryAddr = '0xAbb654092b5BCaeca2E854550c5C972602eF7dA8';

  // wallets
  const [deployer] = await hre.ethers.getSigners();

  await deployDevnetGuardian(
    deployer,
    guardianRegistryAddr,
    recordRegistryAddr,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
