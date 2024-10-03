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
  const centerRegistryAddr = '0xBeB69Fff8C39aa0f2C1896AAa68757e9e2Cf32B4';
  const metadataURL = 'ipfs://QmTdHoVA9gLA1Mk6Csfd2SxMkEdbuSu7xK8dDxUdFVCunx';
  console.log(`guardian address is ${deployer.address}`);
  // await whitelistSignerGuardian(deployer, centerRegistryAddr, deployer, metadataURL);

  const compressedPubKey =
    'e98cd12ffb3bba21b08f5e875a3f1e4498583157621bc8ebdefc972ff4a5d91f';
  const guardianAddress = '0xd47fee108816E4aDdc97A723f5e6CD640F9ecb73';
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
