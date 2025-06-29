/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers, network } from 'hardhat';

/**
 * Script to retrieve encrypted data from on-chain storage.
 */
async function main() {
  let UserEncryptedDataAddress: string;

  const [deployer] = await ethers.getSigners();

  console.log(
    `Deploying contracts with account ${await deployer.getAddress()} on network ${
      network.name
    }`,
  );

  if (network.name === 'galaAndromeda') {
    UserEncryptedDataAddress = '0x6A2abBFC400aEd3f5282028FBbf08e97FC6935DA';
  } else {
    throw new Error('Unknown network');
  }

  const userAddress = '0x2fAA3255e51286480ADC4557eAF0B8456a250B02';

  const userEncryptedDataSC = await ethers.getContractAt(
    'UserEncryptedData',
    UserEncryptedDataAddress,
  );

  const userEncryptedData =
    await userEncryptedDataSC.encryptedData(userAddress);

  console.log(
    `Encrypted data for user ${userAddress} is ${JSON.stringify(
      userEncryptedData,
    )}`,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
