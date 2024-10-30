/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';

import {
  whitelistGuardian,
  // whitelistSignerGuardian,
} from './deploymentSteps/whitelistGuardian';
import { decompressEddsaPubKey } from '../lib';

/**
 * Script for adding a KYC center to the KYC center registry.
 */
async function main() {
  // parameters
  const [deployer] = await ethers.getSigners();
  const centerRegistryAddr = '0x1263E38AFb0449932F1aa0e108a009d895190Ee6';
  const metadataURL = 'ipfs://QmTdHoVA9gLA1Mk6Csfd2SxMkEdbuSu7xK8dDxUdFVCunx';
  console.log(`guardian address is ${deployer.address}`);
  // await whitelistSignerGuardian(deployer, centerRegistryAddr, deployer, metadataURL);

  const compressedPubKey =
    '1c896106914117927552a77aef0a771af8376435adc3fd51f819d34fbfda93a1';
  const guardianAddress = '0x43532C0b134E2173c08b386AA17ec8E8e0ecadd0';
  const pubKey = await decompressEddsaPubKey(compressedPubKey);
  await whitelistGuardian(
    deployer,
    centerRegistryAddr,
    guardianAddress,
    pubKey,
    metadataURL,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
