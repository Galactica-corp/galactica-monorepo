/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ZkCertStandard } from '@galactica-net/galactica-types';
import chalk from 'chalk';
import { buildEddsa } from 'circomlibjs';
import fs from 'fs';
import { task, types } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import path from 'path';

import { printProgress } from '../lib/helpers';
import { parseHolderCommitment } from '../lib/holderCommitment';
import { getEddsaKeyFromEthSigner } from '../lib/keyManagement';
import { buildMerkleTreeFromRegistry } from '../lib/queryMerkleTree';
import { issueZkCert } from '../lib/registryTools';
import { ZkCertificate } from '../lib/zkCertificate';
import { prepareZkCertificateFields } from '../lib/zkCertificateDataProcessing';

/**
 * Script for creating a zkCertificate, issuing it and adding a merkle proof for it.
 * @param args - See task definition below or 'npx hardhat createZkCertificate --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  console.log('Creating zkCertificate');

  const eddsa = await buildEddsa();

  const [issuer] = await hre.ethers.getSigners();
  console.log(
    `Using provider ${chalk.yellow(
      issuer.address.toString(),
    )} to sign the zkCertificate`,
  );

  // read certificate data file
  const data = JSON.parse(fs.readFileSync(args.dataFile, 'utf-8'));
  let zkCertificateType;
  if (args.zkCertificateType === 'zkKYC') {
    zkCertificateType = ZkCertStandard.ZkKYC;
  } else if (args.zkCertificateType === `twitterZkCertificate`) {
    zkCertificateType = ZkCertStandard.TwitterZkCertificate;
  } else {
    throw new Error(
      `ZkCertStandard type ${args.zkCertificateType} is unsupported`,
    );
  }
  const zkCertificateFields = prepareZkCertificateFields(
    eddsa,
    data,
    zkCertificateType,
  );

  // read holder commitment file
  const holderCommitmentFile = JSON.parse(
    fs.readFileSync(args.holderFile, 'utf-8'),
  );
  const holderCommitmentData = parseHolderCommitment(holderCommitmentFile);

  let randomSalt: number;
  // generate random number as salt for new zkCertificate if not provided
  if (args.randomSalt === undefined) {
    randomSalt = Math.floor(Math.random() * 2 ** 32);
  } else {
    randomSalt = parseInt(args.randomSalt, 10);
  }

  console.log('Creating zkCertificate...');
  // TODO: create ZkKYC subclass requiring all the other fields
  const zkCertificate: ZkCertificate = new ZkCertificate(
    holderCommitmentData.holderCommitment,
    zkCertificateType,
    eddsa,
    randomSalt,
    args.expirationDate,
    Object.keys(zkCertificateFields),
    zkCertificateFields,
  );

  // let provider sign the zkCertificate
  const providerEdDSAKey = await getEddsaKeyFromEthSigner(issuer);
  zkCertificate.signWithProvider(providerEdDSAKey);

  console.log(chalk.green(`created the zkCertificate ${zkCertificate.did}`));

  if (args.registryAddress === undefined) {
    console.log(
      'zkCertificate',
      JSON.stringify(zkCertificate.exportRaw(), null, 2),
    );
    console.log(
      chalk.yellow(
        "Parameter 'registry-address' is missing. The zkCertificate has not been issued on chain",
      ),
    );
  } else {
    const recordRegistry = await hre.ethers.getContractAt(
      'ZkCertificateRegistry',
      args.registryAddress,
    );

    console.log(
      'Generating merkle proof. This might take a while because it needs to query on-chain data...',
    );
    // Note for developers: The slow part of building the Merkle tree can be skipped if you build a back-end service maintaining an updated Merkle tree
    const merkleTree = await buildMerkleTreeFromRegistry(
      recordRegistry,
      hre.ethers.provider,
      32,
      printProgress,
    );

    console.log('Issuing zkCertificate...');
    const { merkleProof, registration } = await issueZkCert(
      zkCertificate,
      recordRegistry,
      issuer,
      merkleTree,
    );
    console.log(
      chalk.green(
        `Issued the zkCertificate certificate ${zkCertificate.did} on chain at index ${registration.leafIndex}`,
      ),
    );

    // print to console for developers and testers, not necessary for production
    const rawJSON = {
      ...zkCertificate.exportRaw(),
      merkleProof,
      registration,
    };
    console.log(JSON.stringify(rawJSON, null, 2));

    console.log(chalk.green('This ZkCertificate can be imported in a wallet'));
    // write encrypted zkCertificate output to file
    const output = zkCertificate.exportJson(
      holderCommitmentData.encryptionPubKey,
      merkleProof,
      registration,
    );

    const outputFileName: string =
      args.outputFile || `issuedZkCertificates/${zkCertificate.zkCertStandard}_${zkCertificate.leafHash}.json`;
    fs.mkdirSync(path.dirname(outputFileName), { recursive: true });
    fs.writeFileSync(outputFileName, output);
    console.log(
      chalk.green(`Written ZkCertificate to output file ${outputFileName}`),
    );

    console.log(chalk.green('done'));
  }
}

task(
  'createZkCertificate',
  'Task to create a zkKYC certificate with input parameters',
)
  .addParam(
    'holderFile',
    'Path to the file containing the encryption key and the holder commitment fixing the address of the holder without disclosing it to the provider',
    undefined,
    string,
    false,
  )
  .addParam(
    'dataFile',
    'The file containing the KYC data',
    undefined,
    types.string,
    false,
  )
  .addParam(
    'zkCertificateType',
    'type of zkCertificate, default to be zkKYC',
    undefined,
    types.string,
    false,
  )
  .addParam(
    'randomSalt',
    'random salt, default to be randomly chosen by the system',
    undefined,
    types.string,
    false,
  )
  .addParam(
    'expirationDate',
    'How long should the zkCert be valid? (as Unix timestamp)',
    undefined,
    types.int,
    false,
  )
  .addParam(
    'registryAddress',
    'The smart contract address where zkCertificates are registered',
    undefined,
    types.string,
    true,
  )
  .addParam(
    'outputFile',
    'Where to write the result JSON file to?',
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
