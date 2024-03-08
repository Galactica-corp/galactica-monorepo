/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers, network } from 'hardhat';
import { deploySC } from '../lib/hardhatHelpers';
import { poseidonContract } from 'circomlibjs';
import { overwriteArtifact } from '../lib/helpers';

/**
 * Deploys a contract that everyone can use to submit encrypted Data for on-chain storage.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    `Deploying contracts with account ${deployer.address} on network ${network.name}`,
  );

  console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);

   // get poseidon from library
   await overwriteArtifact(hre, 'PoseidonT3', poseidonContract.createCode(2));

   const poseidonT3 = await deploySC('PoseidonT3', false);

      // initialize the contract
  const guardianRegistryAddress = "0xb5e4A15F468AC505Bf0D53ceA2144b52135cCEF9";
  const description = "twitter ZkCertificate";
  const ZkCertificateRegistry = await deploySC("ZkCertificateRegistry",true, {libraries: {PoseidonT3: poseidonT3.address,}}, [guardianRegistryAddress, description]);

  console.log(
    `The address of the contract is ${ZkCertificateRegistry.address}`,
  );



}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
