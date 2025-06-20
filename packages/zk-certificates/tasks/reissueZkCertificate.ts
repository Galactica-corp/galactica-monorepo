/* eslint-disable prefer-const */
/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ZkCertStandard } from '@galactica-net/galactica-types';
import chalk from 'chalk';
import { buildEddsa } from 'circomlibjs';
import fs from 'fs';
import { task, types } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import path from 'path';

import { hashStringToFieldNumber, printProgress } from '../lib/helpers';
import { parseHolderCommitment } from '../lib/holderCommitment';
import { getEddsaKeyFromEthSigner } from '../lib/keyManagement';
import { buildMerkleTreeFromRegistry } from '../lib/queryMerkleTree';
import {
  issueZkCert,
  revokeZkCert,
  registerZkCertToQueue,
  waitOnIssuanceQueue,
} from '../lib/registryTools';
import { flagStandardMapping, ZkCertificate } from '../lib/zkCertificate';
import { prepareZkCertificateFields } from '../lib/zkCertificateDataProcessing';
import type { ZkCertificateRegistry } from '../typechain-types/contracts/ZkCertificateRegistry';
import type { ZkKYCRegistry } from '../typechain-types/contracts/ZkKYCRegistry';

/**
 * Script for reissuing a zkCertificate with current time stamp and adding a new merkle proof for it.
 * @param args - See task definition below or 'npx hardhat reissueZkCertificate --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  console.log('Reissuing zkCertificate');

  const eddsa = await buildEddsa();

  const [issuer] = await hre.ethers.getSigners();
  console.log(
    `Using provider ${chalk.yellow(
      issuer.address.toString(),
    )} to sign the zkCertificate`,
  );

  // read certificate data file
  const data = JSON.parse(fs.readFileSync(args.dataFile, 'utf-8'));
  const zkCertificateType = flagStandardMapping[args.zkCertificateType];
  if (zkCertificateType === undefined) {
    throw new Error(
      `ZkCertStandard type ${
        args.zkCertificateType
      } is unsupported, available options: ${JSON.stringify(
        Object.keys(flagStandardMapping),
      )}`,
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

  // generate random number as salt for new zkKYC
  const randomSalt = hashStringToFieldNumber(
    Math.random().toString(),
    eddsa.poseidon,
  );

  const newZkCertificate = new ZkCertificate(
    holderCommitmentData.holderCommitment,
    zkCertificateType,
    eddsa,
    randomSalt,
    args.expirationDate,
    zkCertificateFields,
  );

  // let provider sign the zkCertificate
  const providerEdDSAKey = await getEddsaKeyFromEthSigner(issuer);
  newZkCertificate.signWithProvider(providerEdDSAKey);

  const recordRegistry = (await hre.ethers.getContractAt(
    zkCertificateType === ZkCertStandard.ZkKYC
      ? 'ZkKYCRegistry'
      : 'ZkCertificateRegistry',
    args.registryAddress,
  )) as unknown as ZkCertificateRegistry | ZkKYCRegistry;

  console.log(
    'Generating merkle proof. This might take a while because it needs to query on-chain data...',
  );
  const merkleTreeDepth = await recordRegistry.treeDepth();
  // Note for developers: The slow part of building the Merkle tree can be skipped if you build a back-end service maintaining an updated Merkle tree
  let merkleTree = await buildMerkleTreeFromRegistry(
    recordRegistry as ZkCertificateRegistry,
    hre.ethers.provider,
    Number(merkleTreeDepth),
    printProgress,
  );
  const leafHashToRevoke = merkleTree.retrieveLeaf(0, args.index);

  console.log('Register zkCertificate to the queue to revoke...');
  await registerZkCertToQueue(leafHashToRevoke, recordRegistry, issuer);

  await waitOnIssuanceQueue(
    recordRegistry,
    leafHashToRevoke,
    hre.ethers.provider,
  );

  console.log('Rebuild merkle tree after waiting for queue.');
  merkleTree = await buildMerkleTreeFromRegistry(
    recordRegistry as ZkCertificateRegistry,
    hre.ethers.provider,
    Number(merkleTreeDepth),
    printProgress,
  );

  // reissue = revoke + issue
  console.log('revoking previous entry...');
  await revokeZkCert(
    leafHashToRevoke,
    args.index,
    recordRegistry as ZkCertificateRegistry,
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

  console.log('Register zkCertificate to the queue to readd...');
  await registerZkCertToQueue(
    newZkCertificate.leafHash,
    recordRegistry,
    issuer,
  );

  await waitOnIssuanceQueue(
    recordRegistry,
    newZkCertificate.leafHash,
    hre.ethers.provider,
  );

  console.log(
    'Generating merkle proof. This might take a while because it needs to query on-chain data...',
  );

  const merkleTree2 = await buildMerkleTreeFromRegistry(
    recordRegistry as ZkCertificateRegistry,
    hre.ethers.provider,
    Number(merkleTreeDepth),
    printProgress,
  );

  console.log('Issuing zkCertificate...');
  const { merkleProof, registration } = await issueZkCert(
    newZkCertificate,
    recordRegistry,
    issuer,
    merkleTree2,
    hre.ethers.provider,
  );
  console.log(
    chalk.green(
      `reissued the zkCertificate ${newZkCertificate.did} on chain at index ${
        args.index as number
      } with new expiration date ${args.expirationDate as number}`,
    ),
  );

  // print to console for developers and testers, not necessary for production
  const rawJSON = {
    ...newZkCertificate.exportRaw(),
    merkleProof,
    registration,
  };
  console.log(JSON.stringify(rawJSON, null, 2));

  console.log(chalk.green('This ZkCertificate can be imported in a wallet'));
  // write encrypted zkCertificate output to file
  const output = newZkCertificate.exportJson(
    holderCommitmentData.encryptionPubKey,
    merkleProof,
    registration,
  );

  const outputFileName: string =
    args.outputFile ||
    `issuedZkCertificates/${newZkCertificate.zkCertStandard}_${newZkCertificate.leafHash}.json`;
  fs.mkdirSync(path.dirname(outputFileName), { recursive: true });
  fs.writeFileSync(outputFileName, output);
  console.log(
    chalk.green(`Written ZkCertificate to output file ${outputFileName}`),
  );

  console.log(chalk.green('done'));
}

task(
  'reissueZkCertificate',
  'Task to reissue a zkCertificate with later expiration date',
)
  .addParam(
    'index',
    'index of the zkCertificate to be updated',
    undefined,
    types.int,
    false,
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
    'dataFile',
    'The file containing the KYC data',
    undefined,
    types.string,
    false,
  )
  .addParam(
    'zkCertificateType',
    `type of zkCertificate, default to be kyc. Available options: ${JSON.stringify(
      Object.keys(flagStandardMapping),
    )}`,
    undefined,
    types.string,
    false,
  )
  .addParam(
    'registryAddress',
    'The smart contract address where zkCertificates are registered',
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
