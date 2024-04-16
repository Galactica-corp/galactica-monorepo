/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import chalk from 'chalk';
import { task, types } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import { printProgress } from '../lib/helpers';
import { buildMerkleTreeFromRegistry } from '../lib/queryMerkleTree';
import { revokeZkCert } from '../lib/registryTools';

/**
 * Script for revoking a zkKYC certificate, issuing it and adding a merkle proof for it.
 * @param args - See task definition below or 'npx hardhat createZkKYC --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  console.log('Revoking zkKYC certificate');

  const [provider] = await hre.ethers.getSigners();
  console.log(
    `Using provider ${chalk.yellow(
      provider.address.toString(),
    )} to revoke the zkKYC certificate`,
  );

  if (args.registryAddress === undefined) {
    console.log(
      chalk.yellow(
        "Parameter 'registry-address' is missing. The zkKYC has not been issued on chain",
      ),
    );
    return;
  }

  console.log('Revoking zkKYC...');
  const recordRegistry = await hre.ethers.getContractAt(
    'KYCRecordRegistry',
    args.registryAddress,
  );

  console.log(
    'Generating merkle tree. This might take a while because it needs to query on-chain data...',
  );
  // Note for developers: The slow part of building the Merkle tree can be skipped if you build a back-end service maintaining an updated Merkle tree
  const merkleTree = await buildMerkleTreeFromRegistry(
    recordRegistry,
    hre.ethers.provider,
    32,
    printProgress,
  );

  await revokeZkCert(
    args.leafHash,
    args.index,
    recordRegistry,
    provider,
    merkleTree,
  );

  console.log(
    chalk.green(
      `Revoked the zkKYC certificate ${args.leafHash} on-chain at index ${
        args.index as number
      }`,
    ),
  );
}

task(
  'revokeZkKYC',
  'Task to revoke a zkKYC certificate with leaf hash and merkle tree',
)
  .addParam(
    'leafHash',
    'leaf hash of the zkKYC record in the merkle tree',
    undefined,
    string,
    false,
  )
  .addParam('index', 'index of the leaf in the merkle tree', 0, types.int, true)
  .addParam(
    'registryAddress',
    'The smart contract address where zkKYCs are registered',
    undefined,
    types.string,
    true,
  )
  .setAction(async (taskArgs, hre) => {
    await main(taskArgs, hre).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
