/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers, network } from 'hardhat';

/**
 * Deploys a contract that everyone can use to submit encrypted Data for on-chain storage.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    `Deploying contracts with account ${deployer.address} on network ${network.name}`,
  );

  console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  const SBTManagerAddress = '0x361d57F0F239dCC538E5a0c81a394C15127DF2A8';
  const SBTManagerInstance = await ethers.getContractAt(
    'SBTManager',
    SBTManagerAddress,
  );
  const SBTManagerOwner = await SBTManagerInstance.owner();
  console.log(`SBTManager owner: ${SBTManagerOwner}`);

  const VerifierWrapperAddress = '0xd80b686231f78A0cf612e34164325ABd9320d2A5';
  const SBTAddress = '0x541309D832E29F05a0A5162cF03bEb6a54146d2C';
  const SBTIndex = 2;

  await SBTManagerInstance.setSBT(SBTIndex, SBTAddress);
  await SBTManagerInstance.setVerifierWrapper(SBTIndex, VerifierWrapperAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
