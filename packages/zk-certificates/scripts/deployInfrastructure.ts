/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import hre from 'hardhat';

import { deployInfrastructure } from './deploymentSteps/infrastructure';

/**
 * Script to deploy the infrastructure for zkKYC.
 * Including:
 * - PoseidonT3 hash function
 * - GuardianRegistry
 * - KYCRecordRegistry
 * - ExampleMockDAppVerifier
 * - 3 example institutions for fraud investigation
 * - AgeProofZkKYC.
 */
async function main() {
  const [deployer, institution1, institution2, institution3] =
    await hre.ethers.getSigners();
  const institutions = [institution1, institution2, institution3];

  await deployInfrastructure(deployer, institutions);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
