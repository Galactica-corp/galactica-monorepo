/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ZkCertStandard } from '@galactica-net/galactica-types';
import chalk from 'chalk';
import { buildEddsa } from 'circomlibjs';
import fs from 'fs';
import { task, types } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import path from 'path';

import { parseHolderCommitment } from '../lib/holderCommitment';
import { getEddsaKeyFromEthSigner } from '../lib/keyManagement';
import { buildMerkleTreeFromRegistry } from '../lib/queryMerkleTree';
import { issueZkCert } from '../lib/registryTools';
import { ZKCertificate } from '../lib/zkCertificate';
import { prepareKYCFields } from '../lib/zkKYC';

/**
 * Script for creating a zkKYC certificate, issuing it and adding a merkle proof for it.
 * @param args - See task definition below or 'npx hardhat createZkKYC --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  console.log('Creating zkKYC certificate');

  const eddsa = await buildEddsa();

  const [issuer] = await hre.ethers.getSigners();
  console.log(
    `Using provider ${chalk.yellow(
      issuer.address.toString(),
    )} to sign the zkKYC certificate`,
  );

  // read KYC data file
  const data = JSON.parse(fs.readFileSync(args.kycDataFile, 'utf-8'));
  const zkKYCFields = prepareKYCFields(eddsa, data);

  // read holder commitment file
  const holderCommitmentFile = JSON.parse(
    fs.readFileSync(args.holderFile, 'utf-8'),
  );
  const holderCommitmentData = parseHolderCommitment(holderCommitmentFile);

  // generate random number as salt for new zkKYC
  const randomSalt = Math.floor(Math.random() * 2 ** 32);

  console.log('Creating zkKYC...');
  // TODO: create ZkKYC subclass requiring all the other fields
  const zkKYC = new ZKCertificate(
    holderCommitmentData.holderCommitment,
    ZkCertStandard.ZkKYC,
    eddsa,
    randomSalt,
    zkKYCFields,
  );

  // let provider sign the zkKYC
  const providerEdDSAKey = await getEddsaKeyFromEthSigner(issuer);
  zkKYC.signWithProvider(providerEdDSAKey);

  console.log(chalk.green(`created the zkKYC certificate ${zkKYC.did}`));

  if (args.registryAddress === undefined) {
    console.log('zkKYC', JSON.stringify(zkKYC.exportRaw(), null, 2));
    console.log(
      chalk.yellow(
        "Parameter 'registry-address' is missing. The zkKYC has not been issued on chain",
      ),
    );
    return;
  }

  const recordRegistry = await hre.ethers.getContractAt(
    'KYCRecordRegistry',
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
  );

  console.log('Issuing zkKYC...');
  const { merkleProof, registration } = await issueZkCert(
    zkKYC,
    recordRegistry,
    issuer,
    merkleTree,
  );
  console.log(
    chalk.green(
      `Issued the zkKYC certificate ${zkKYC.did} on chain at index ${registration.leafIndex}`,
    ),
  );

  // print to console for developers and testers, not necessary for production
  const rawJSON = {
    ...zkKYC.exportRaw(),
    merkleProof,
    registration,
  };
  console.log(JSON.stringify(rawJSON, null, 2));

  console.log(chalk.green('This ZkKYC can be imported in a wallet'));
  // write encrypted zkKYC output to file
  const output = zkKYC.exportJson(
    holderCommitmentData.encryptionPubKey,
    merkleProof,
    registration,
  );

  const outputFileName: string =
    args.outputFile || `issuedZkKYCs/${zkKYC.leafHash}.json`;
  fs.mkdirSync(path.dirname(outputFileName), { recursive: true });
  fs.writeFileSync(outputFileName, output);
  console.log(chalk.green(`Written ZkKYC to output file ${outputFileName}`));

  console.log(chalk.green('done'));
}

task('createZkKYC', 'Task to create a zkKYC certificate with input parameters')
  .addParam(
    'holderFile',
    'Path to the file containing the encryption key and the holder commitment fixing the address of the holder without disclosing it to the provider',
    undefined,
    string,
    false,
  )
  .addParam(
    'kycDataFile',
    'The file containing the KYC data',
    undefined,
    types.string,
    false,
  )
  .addParam(
    'registryAddress',
    'The smart contract address where zkKYCs are registered',
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
