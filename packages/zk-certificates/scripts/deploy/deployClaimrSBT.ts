/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import csv from 'csvtojson';
import { ethers, network } from 'hardhat';
import path from 'path';

import { deploySC } from '../../lib/hardhatHelpers';

/**
 * Deploys a contract that everyone can use to submit encrypted Data for on-chain storage.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const csvPath = path.join(__dirname, '../data/MintList.csv');
  console.log('Reading csv from ', csvPath);
  const signee = '0x333e271244f12351b6056130AEC894EB8AAf05C2';

  console.log(
    `Deploying contracts with account ${await deployer.getAddress()} on network ${
      network.name
    }`,
  );

  console.log(
    `Account balance: ${(
      await ethers.provider.getBalance(deployer)
    ).toString()}`,
  );

  const csvData = await csv().fromFile(csvPath);
  if (csvData.length > 0) {
    // For each row in the CSV, extract the parameters and deploy the contract.
    for (const row of csvData) {
      // Assuming the CSV columns are named "uri", "nftName", and "nftSymbol"
      const uri = row.metadata;
      const nftName = row['SBT Name'];
      const nftSymbol = row.Ticker;
      console.log(
        `Deploying SBT for NFT: ${nftName} (${nftSymbol}) with URI: ${uri}`,
      );

      const sbt = await deploySC('claimrSignedSBT', true, {}, [
        nftName,
        nftSymbol,
        uri,
        signee,
      ]);
      console.log(`${nftName} deployed at ${await sbt.getAddress()}`);
    }
    // If CSV data was processed, exit main to prevent further (default) deployment.
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
