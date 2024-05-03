/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { poseidonContract } from 'circomlibjs';
import { ethers, network } from 'hardhat';

import { deploySC } from '../lib/hardhatHelpers';
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
  const guardianRegistryAddress = '0x41e20898EbecC78DbE6d638BB331C70BA4E30346';
  const description = 'twitter ZkCertificate';
  await deploySC(
    'ZkCertificateRegistry',
    true,
    { libraries: { PoseidonT3: poseidonT3.address } },
    [guardianRegistryAddress, description],
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
