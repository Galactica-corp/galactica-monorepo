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
import { issueZkCert, revokeZkCert } from '../lib/registryTools';
import { ZKCertificate } from '../lib/zkCertificate';
import { prepareKYCFields } from '../lib/zkKYC';

/**
 * Script for reissuing a zkKYC certificate with current time stamp and adding a new merkle proof for it.
 * @param args - See task definition below or 'npx hardhat reissueZkKYC --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  console.log('Creating zkKYC certificate');

  const [issuer] = await hre.ethers.getSigners();
  console.log(
    `Using provider ${chalk.yellow(
      issuer.address.toString(),
    )} to sign the zkKYC certificate`,
  );

  const data = JSON.parse(fs.readFileSync(args.kycDataFile, 'utf-8'));
  const eddsa = await buildEddsa();
  const zkKYCFields = prepareKYCFields(eddsa, data);

  // read holder commitment file
  const holderCommitmentFile = JSON.parse(
    fs.readFileSync(args.holderFile, 'utf-8'),
  );
  const holderCommitmentData = parseHolderCommitment(holderCommitmentFile);

  // generate random number as salt for new zkKYC
  const randomSalt = Math.floor(Math.random() * 2 ** 32);

  const newZkKYC = new ZKCertificate(
    holderCommitmentFile.holderCommitment,
    ZkCertStandard.ZkKYC,
    eddsa,
    randomSalt,
    args.expirationDate,
    zkKYCFields,
  );

  // let provider sign the zkKYC
  const providerEdDSAKey = await getEddsaKeyFromEthSigner(issuer);
  newZkKYC.signWithProvider(providerEdDSAKey);

  const recordRegistry = await hre.ethers.getContractAt(
    'KYCRecordRegistry',
    args.registryAddress,
  );

  console.log(
    'Generating merkle proof. This might take a while because it needs to query on-chain data...',
  );
  const merkleTreeDepth = await recordRegistry.treeDepth();
  // Note for developers: The slow part of building the Merkle tree can be skipped if you build a back-end service maintaining an updated Merkle tree
  const merkleTree = await buildMerkleTreeFromRegistry(
    recordRegistry,
    hre.ethers.provider,
    merkleTreeDepth,
    printProgress,
  );

  // reissue = revoke + issue
  console.log('revoking previous entry...');
  await revokeZkCert(
    merkleTree.retrieveLeaf(0, args.index),
    args.index,
    recordRegistry,
    issuer,
    merkleTree,
  );
  console.log(
    chalk.green(
      `Revoked the zkKYC certificate ${args.leafHash} on-chain at index ${args.index as number
      }`,
    ),
  );

  console.log('Issuing zkKYC...');
  const { merkleProof, registration } = await issueZkCert(
    newZkKYC,
    recordRegistry,
    issuer,
    merkleTree,
  );
  console.log(
    chalk.green(
      `reissued the zkKYC certificate ${newZkKYC.did} on chain at index ${args.index as number
      } with new expiration date ${args.expirationDate as number}`,
    ),
  );

  // print to console for developers and testers, not necessary for production
  const rawJSON = {
    ...newZkKYC.exportRaw(),
    merkleProof,
    registration,
  };
  console.log(JSON.stringify(rawJSON, null, 2));

  console.log(chalk.green('This ZkKYC can be imported in a wallet'));
  // write encrypted zkKYC output to file
  const output = newZkKYC.exportJson(
    holderCommitmentData.encryptionPubKey,
    merkleProof,
    registration,
  );

  const outputFileName: string =
    args.outputFile || `issuedZkKYCs/${newZkKYC.leafHash}.json`;
  fs.mkdirSync(path.dirname(outputFileName), { recursive: true });
  fs.writeFileSync(outputFileName, output);
  console.log(chalk.green(`Written ZkKYC to output file ${outputFileName}`));

  console.log(chalk.green('done'));
}

task(
  'reissueZkKYC',
  'Task to reissue a zkKYC certificate with later expiration date',
)
  .addParam(
    'index',
    'index of the zkKYC certificate to be updated',
    0,
    types.int,
    true,
  )
  .addParam(
    'expirationDate',
    'New expiration date how long the zkCert should be valid (as Unix timestamp)',
    0,
    types.int,
    true,
  )
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
    false,
  )
  .addParam(
    'merkleProof',
    'Should the script also create a merkle proof?',
    true,
    types.boolean,
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
