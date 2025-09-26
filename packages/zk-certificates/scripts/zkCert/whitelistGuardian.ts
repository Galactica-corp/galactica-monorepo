/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
// import { buildEddsa } from 'circomlibjs';
import { ethers } from 'hardhat';

// import {
//   convertPubkeyToDecimal,
//   decompressEddsaPubKey,
//   getEddsaKeyFromEthSigner,
// } from '../../lib';
import type { GuardianRegistry } from '../../typechain-types';

/**
 * Script for adding a KYC center to the KYC center registry.
 */
async function main() {
  // parameters
  const centerRegistryAddr = '0xBa7Eb6db891F6872A6ad43A97ef582B57E169063';
  const metadataURL =
    'https://dataguardian.s3.eu-central-1.amazonaws.com/OccamDataGuardianMetadata.json';

  const guardianAddress = '0x3D16Ea1a1a4129464466D5c75347a88Bf73a2288';
  // const compressedPubKey =
  //   '1c896106914117927552a77aef0a771af8376435adc3fd51f819d34fbfda93a1';
  // const pubKey = await decompressEddsaPubKey(compressedPubKey);
  const pubKey: [string, string] = [
    '6925081015152596833630127274578745799802479602575631362893913163012217004972',
    '13685913678080322977211435444902747344004323816568707550537909034728228077768',
  ];

  // const [deployer] = await ethers.getSigners();
  // const guardianAddress = await deployer.getAddress();
  // const eddsa = await buildEddsa();
  // const privKey = await getEddsaKeyFromEthSigner(deployer);
  // const pubKey = convertPubkeyToDecimal(eddsa.prv2pub(privKey), eddsa);

  const guardianRegistry = (await ethers.getContractAt(
    'GuardianRegistry',
    centerRegistryAddr,
  )) as unknown as GuardianRegistry;
  const tx = await guardianRegistry.grantGuardianRole(
    guardianAddress,
    pubKey,
    metadataURL,
  );
  await tx.wait();
  console.log('Guardian whitelisted, tx hash:', tx.hash);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
