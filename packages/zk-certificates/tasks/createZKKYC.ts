/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import {
  ZkCertStandard,
  zkKYCContentFields,
} from '@galactica-net/galactica-types';
import chalk from 'chalk';
import { buildEddsa, buildPoseidon } from 'circomlibjs';
import fs from 'fs';
import { task, types } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import path from 'path';

import {
  fromDecToHex,
  fromHexToBytes32,
  hashStringToFieldNumber,
} from '../lib/helpers';
import { getEddsaKeyFromEthSigner } from '../lib/keyManagement';
import { queryOnChainLeaves } from '../lib/queryMerkleTree';
import { SparseMerkleTree } from '../lib/sparseMerkleTree';
import { ZKCertificate } from '../lib/zkCertificate';

/**
 * Script for creating a zkKYC certificate, issuing it and adding a merkle proof for it.
 * @param args - See task definition below or 'npx hardhat createZkKYC --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  console.log('Creating zkKYC certificate');

  const [provider] = await hre.ethers.getSigners();
  console.log(
    `Using provider ${chalk.yellow(
      provider.address.toString(),
    )} to sign the zkKYC certificate`,
  );

  console.log('randomSalt', args.randomSalt);

  console.log(`reading KYC data from ${args.kycDataFile as string}`);
  const data = JSON.parse(fs.readFileSync(args.kycDataFile, 'utf-8'));
  console.log('input data', data);

  const eddsa = await buildEddsa();

  // verify that all the fields are present
  const exceptions = ['holderCommitment'];
  const stringFieldsForHashing = [
    // TODO: standardize the definition of fields and which of those are hashed and read it from the standard instead of hardcoding it here
    'surname',
    'forename',
    'middlename',
    'streetAndNumber',
    'postcode',
    'town',
    'region',
    'country',
    'citizenship',
    'passportID',
  ];
  const zkKYCFields: Record<string, any> = {};
  for (const field of zkKYCContentFields.filter(
    (content) => !exceptions.includes(content),
  )) {
    if (data[field] === undefined) {
      throw new Error(`Field ${field} missing in KYC data`);
    }
    if (stringFieldsForHashing.includes(field)) {
      // hashing string data so that it fits into the field used by the circuit
      zkKYCFields[field] = hashStringToFieldNumber(data[field], eddsa.poseidon);
    } else {
      zkKYCFields[field] = data[field];
    }
  }

  // read holder commitment file
  const holderCommitmentFile = JSON.parse(
    fs.readFileSync(args.holderFile, 'utf-8'),
  );
  if (
    !holderCommitmentFile.holderCommitment ||
    !holderCommitmentFile.encryptionPubKey
  ) {
    throw new Error(
      'The holder commitment file does not contain the expected fields (holderCommitment, encryptionPubKey)',
    );
  }
  console.log('holderCommitment', holderCommitmentFile.holderCommitment);

  console.log('Creating zkKYC...');
  // TODO: create ZkKYC subclass requiring all the other fields
  const zkKYC = new ZKCertificate(
    holderCommitmentFile.holderCommitment,
    ZkCertStandard.ZkKYC,
    eddsa,
    args.randomSalt,
    zkKYCFields,
  );

  // let provider sign the zkKYC
  const providerEdDSAKey = await getEddsaKeyFromEthSigner(provider);
  zkKYC.signWithProvider(providerEdDSAKey);
  console.log(chalk.green(`created the zkKYC certificate ${zkKYC.did}`));
  console.log(chalk.green(`Leaf Hash: ${zkKYC.leafHash}`));

  if (args.registryAddress === undefined) {
    console.log('zkKYC', JSON.stringify(zkKYC.exportRaw(), null, 2));
    console.log(
      chalk.yellow(
        "Parameter 'registry-address' is missing. The zkKYC has not been issued on chain",
      ),
    );
    return;
  }

  console.log('Issuing zkKYC...');
  const recordRegistry = await hre.ethers.getContractAt(
    'KYCRecordRegistry',
    args.registryAddress,
  );
  const guardianRegistry = await hre.ethers.getContractAt(
    'GuardianRegistry',
    await recordRegistry._GuardianRegistry(),
  );

  if (!(await guardianRegistry.guardians(provider.address))) {
    throw new Error(
      `Provider ${provider.address} is not a guardian yet. Please register it first using the script .`,
    );
  }
  const leafBytes = fromHexToBytes32(fromDecToHex(zkKYC.leafHash));

  if (!args.merkleProof) {
    console.log('zkKYC', JSON.stringify(zkKYC.exportRaw(), null, 2));
    console.log(
      chalk.yellow(
        'Merkle proof generation is disabled. Before using the zkKYC, you need to generate the merkle proof.',
      ),
    );
    return;
  }

  console.log(
    'Generating merkle proof. This might take a while because it needs to query on-chain data...',
  );
  // Note for developers: The slow part of building the Merkle tree can be skipped if you build a back-end service maintaining an updated Merkle tree
  const poseidon = await buildPoseidon();
  const merkleDepth = 32;
  const leafLogResults = await queryOnChainLeaves(
    hre.ethers,
    recordRegistry.address,
  ); // TODO: provide first block to start querying from to speed this up
  const leafHashes = leafLogResults.map((value) => value.leafHash);
  const leafIndices = leafLogResults.map((value) => Number(value.index));
  // console.log(`leafHashes ${JSON.stringify(leafHashes)}`);
  // console.log(`leafIndices ${JSON.stringify(leafIndices)}`);
  const merkleTree = new SparseMerkleTree(merkleDepth, poseidon);
  const batchSize = 10_000;
  for (let i = 0; i < leafLogResults.length; i += batchSize) {
    merkleTree.insertLeaves(
      leafHashes.slice(i, i + batchSize),
      leafIndices.slice(i, i + batchSize),
    );
  }
  // console.log(`merkle root is ${merkleTree.root}`);

  // find the smallest index of an empty list
  let index = 0;
  // firstly we sort the list of indices
  leafIndices.sort();
  // if the list is not empty and the first index is 0 then we proceed to find the gap
  // otherwise the index remains 0
  if (leafIndices.length >= 1 && leafIndices[0] === 0) {
    for (let i = 0; i < leafIndices.length - 1; i++) {
      if (leafIndices[i + 1] - leafIndices[i] >= 2) {
        index = leafIndices[i] + 1;
        break;
      }
    }
    // if the index is not assigned in the for loop yet, i.e. there is no gap in the indices array
    if (index === 0) {
      index = leafIndices[leafIndices.length - 1] + 1;
    }
  }

  // create Merkle proof
  let merkleProof = merkleTree.createProof(index);
  // console.log(`Merkle proof for index ${index} is ${JSON.stringify(merkleProof)}`);

  // now we have the merkle proof to add a new leaf
  const tx = await recordRegistry.addZkKYCRecord(
    index,
    leafBytes,
    merkleProof.path.map((value) => fromHexToBytes32(fromDecToHex(value))),
  );
  await tx.wait();
  console.log(
    chalk.green(
      `Issued the zkKYC certificate ${zkKYC.did} on chain at index ${index}`,
    ),
  );

  // update the merkle tree according to the new leaf
  merkleTree.insertLeaves([zkKYC.leafHash], [index]);
  merkleProof = merkleTree.createProof(index);

  console.log(chalk.green('ZkKYC (created, issued, including merkle proof)'));
  const rawJSON = {
    ...zkKYC.exportRaw(),
    merkleProof: {
      root: merkleTree.root,
      pathIndices: merkleProof.pathIndices,
      pathElements: merkleProof.path,
      leaf: zkKYC.leafHash,
    },
    registration: {
      address: recordRegistry.address,
      revocable: true,
      leafIndex: index,
    },
  };
  console.log(JSON.stringify(rawJSON, null, 2));
  console.log(chalk.green('This ZkKYC can be imported in a wallet'));

  // write encrypted zkKYC output to file
  const output = zkKYC.exportJson(
    holderCommitmentFile.encryptionPubKey,
    {
      root: merkleTree.root,
      leafIndex: merkleProof.leafIndex,
      pathElements: merkleProof.path,
      leaf: zkKYC.leafHash,
    },
    {
      address: recordRegistry.address,
      revocable: true,
      leafIndex: index,
    },
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
    'randomSalt',
    'Random salt to input into zkCert hashing',
    0,
    types.int,
    true,
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
