/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers, network } from "hardhat";

async function main() {

    const [deployer] = await ethers.getSigners();

    console.log(`Deploying contracts with account ${deployer.address} on network ${network.name}`);

    console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  const UserEncryptedDataFactory = await ethers.getContractFactory("UserEncryptedData");
  const UserEncryptedDataInstance = await UserEncryptedDataFactory.deploy();


  console.log(`The address of the contract is ${UserEncryptedDataInstance.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
