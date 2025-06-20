/* eslint-disable prefer-const */
/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import chalk from 'chalk';
import { task, types } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import { printProgress } from '../lib/helpers';
import { buildMerkleTreeFromRegistry } from '../lib/queryMerkleTree';
import {
  revokeZkCert,
  registerZkCertToQueue,
  waitOnIssuanceQueue,
} from '../lib/registryTools';
import type { ZkCertificateRegistry } from '../typechain-types/contracts/ZkCertificateRegistry';

/**
 * Script for revoking a zkCertificate, issuing it and adding a merkle proof for it.
 * @param args - See task definition below or 'npx hardhat revokeZkCertificate --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  console.log('Revoking zkCertificate');

  const [issuer] = await hre.ethers.getSigners();
  console.log(
    `Using issuer ${chalk.yellow(
      issuer.address.toString(),
    )} to revoke the zkCertificate`,
  );

  if (args.registryAddress === undefined) {
    console.log(
      chalk.yellow(
        "Parameter 'registry-address' is missing. Revocation cannot proceed",
      ),
    );
    return;
  }

  console.log('Revoking zkCertificate...');
  const recordRegistry = (await hre.ethers.getContractAt(
    'ZkCertificateRegistry',
    args.registryAddress,
  )) as unknown as ZkCertificateRegistry;

  console.log('Register zkCertificate to the queue...');
  await registerZkCertToQueue(args.leafHash, recordRegistry, issuer);

  await waitOnIssuanceQueue(recordRegistry, args.leafHash, hre.ethers.provider);

  console.log(
    'Generating merkle tree. This might take a while because it needs to query on-chain data...',
  );
  const merkleTreeDepth = await recordRegistry.treeDepth();
  // Note for developers: The slow part of building the Merkle tree can be skipped if you build a back-end service maintaining an updated Merkle tree
  const merkleTree = await buildMerkleTreeFromRegistry(
    recordRegistry,
    hre.ethers.provider,
    Number(merkleTreeDepth),
    printProgress,
  );

  if (args.index === undefined) {
    args.index = merkleTree.getLeafIndex(args.leafHash);
  }

  await revokeZkCert(
    args.leafHash,
    args.index,
    recordRegistry,
    issuer,
    merkleTree,
  );

  console.log(
    chalk.green(
      `Revoked the zkCertificate ${args.leafHash} on-chain at index ${
        args.index as number
      }`,
    ),
  );
}

task(
  'revokeZkCertificate',
  'Task to revoke a zkCertificate with leaf hash and merkle tree',
)
  .addParam(
    'leafHash',
    'leaf hash of the zkCertificate record in the merkle tree',
    undefined,
    string,
    false,
  )
  .addParam(
    'index',
    'index of the leaf in the merkle tree',
    undefined,
    types.int,
    true,
  )
  .addParam(
    'registryAddress',
    'The smart contract address where zkCertificates are registered',
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
