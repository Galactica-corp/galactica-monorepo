/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';

import { decompressEddsaPubKey } from '../../lib';
import type { GuardianRegistry } from '../../typechain-types';

/**
 * Script for adding a KYC center to the KYC center registry.
 */
async function main() {
  // parameters
  const centerRegistryAddr = '0x466bF1463F380C903CA69C2FeEF419824D8eA4d7';
  const metadataURL =
    'https://bafybeigkjmb3aeqbfdcqwlbirhbbylce3b5rjttdp2fefnjjuwet5glpxe.ipfs.dweb.link';

  const guardianAddress = '0x43532C0b134E2173c08b386AA17ec8E8e0ecadd0';
  const compressedPubKey =
    '1c896106914117927552a77aef0a771af8376435adc3fd51f819d34fbfda93a1';
  const pubKey = await decompressEddsaPubKey(compressedPubKey);
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
