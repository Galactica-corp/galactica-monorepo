/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import chalk from 'chalk';
import { task, types } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import { revokeZkCert } from '../lib/registryTools';
import type { ZkCertificateRegistry } from '../typechain-types/contracts/ZkCertificateRegistry';

/**
 * Script for revoking a zkCertificate, issuing it and adding a merkle proof for it.
 *
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

  console.log('Queueing revoke operation...');
  await revokeZkCert(args.leafHash, recordRegistry, issuer);
  console.log(
    chalk.green(`Queued revocation for zkCertificate ${args.leafHash}`),
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
