/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { buildEddsa } from 'circomlibjs';
import { ethers } from 'hardhat';

import { getEddsaKeyFromEthSigner } from '../lib/keyManagement';

/**
 * Script for adding a KYC center to the KYC center registry.
 */
async function main() {
  // wallets
  const [deployer] = await ethers.getSigners();
  console.log(`Using account ${deployer.address} for controlling whitelist`);
  console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);
  console.log();

  // parameters
  const centerRegistryAddr = '0x3D8AAba820817254719BD6f997835B6f9F3485e2';
  const guardian = deployer;
  const guardianAddr = guardian.address;
  const guardianName = 'Galactica Test Guardian';
  // get pubkey of guardian, if we have the private key, we can derive it here, otherwise just enter the pubkey
  const eddsa = await buildEddsa();
  const privKey = await getEddsaKeyFromEthSigner(guardian);
  const guardianPubKey = eddsa.prv2pub(privKey);

  console.log(
    `Whitelisting guardian ${
      guardian.address
    } with name ${guardianName} and pubkey ${JSON.stringify(guardianPubKey)}`,
  );

  // get contract
  const guardianRegistry = await ethers.getContractAt(
    'GuardianRegistry',
    centerRegistryAddr,
  );

  console.log(`Adding ${guardianAddr} as guardian...`);
  const tx = await guardianRegistry.grantGuardianRole(
    deployer.address,
    guardianPubKey,
    guardianName,
  );
  await tx.wait();

  console.log(`Done`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
