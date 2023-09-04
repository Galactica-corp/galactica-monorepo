/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from "hardhat";
import { fromDecToHex, fromHexToBytes32 } from "../lib/helpers";


async function main() {
  // parameters
  const centerRegistryAddr = '0x4De49e2047eE726B833fa815bf7392958245832d';
  const recordRegistryAddr = '0x8eD8311ED65eBe2b11ED8cB7076E779c1030F9cF';
  const zkKYCLeafHashes = [
    '13553445873695920927397403858740937949838667812849138092988169793799956616387',
    '913338630289763938167212770624253461411251029088142596559861590717003723041',
  ];

  // wallets
  const [deployer] = await ethers.getSigners();
  console.log(`Using account ${deployer.address} as KYC provider`);
  console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);
  console.log();


  // get contracts
  const centerRegistry = await ethers.getContractAt('KYCCenterRegistry', centerRegistryAddr);
  const recordRegistry = await ethers.getContractAt('KYCRecordRegistry', recordRegistryAddr);

  console.log(`Adding ${deployer.address} as KYC provider...`);
  // TODO: skip when already added
  let tx = await centerRegistry.grantKYCCenterRole(deployer.address);
  await tx.wait();

  for (const zkKYCLeafHash of zkKYCLeafHashes) {
    console.log(`Issuing zkKYC with leaf hash ${zkKYCLeafHash}`);
    const leafBytes = fromHexToBytes32(fromDecToHex(zkKYCLeafHash))
    tx = await recordRegistry.addZkKYCRecord(leafBytes);
    await tx.wait();
  }

  console.log(`Done`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
