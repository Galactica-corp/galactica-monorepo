/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import {
  getContentSchema,
  KnownZkCertStandard,
} from '@galactica-net/galactica-types';
import chalk from 'chalk';
import { buildEddsa } from 'circomlibjs';
import fs from 'fs';
import { task, types } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import path from 'path';

import { hashStringToFieldNumber } from '../lib/helpers';
import { parseHolderCommitment } from '../lib/holderCommitment';
import { getEddsaKeyFromEthSigner } from '../lib/keyManagement';
import {
  checkZkKYCSaltHashCompatibility,
  issueZkCert,
  listZkKYCsLockingTheSaltHash,
  resetSaltHash,
} from '../lib/registryTools';
import { flagStandardMapping, ZkCertificate } from '../lib/zkCertificate';
import type { ZkCertificateRegistry } from '../typechain-types/contracts/ZkCertificateRegistry';
import type { ZkKYCRegistry } from '../typechain-types/contracts/ZkKYCRegistry';

// Tell JSON how to serialize BigInts
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

/**
 * Script for creating a zkCertificate, issuing it and adding a merkle proof for it.
 *
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

  // read holder commitment file
  const holderCommitmentFile = JSON.parse(
    fs.readFileSync(args.holderFile, 'utf-8'),
  );
  const holderCommitmentData = parseHolderCommitment(holderCommitmentFile);

  let { randomSalt } = args;
  // generate random number as salt for new zkCertificate if not provided
  if (randomSalt === undefined) {
    randomSalt = hashStringToFieldNumber(
      Math.random().toString(),
      eddsa.poseidon,
    );
  }

  console.log('Creating zkCertificate...');
  // TODO: create ZkKYC subclass requiring all the other fields
  const zkCertificate: ZkCertificate = new ZkCertificate(
    holderCommitmentData.holderCommitment,
    zkCertificateType,
    eddsa,
    randomSalt,
    args.expirationDate,
    getContentSchema(zkCertificateType),
    data,
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
    const recordRegistry = (await hre.ethers.getContractAt(
      zkCertificateType === KnownZkCertStandard.ZkKYC
        ? 'ZkKYCRegistry'
        : 'ZkCertificateRegistry',
      args.registryAddress,
    )) as unknown as ZkCertificateRegistry | ZkKYCRegistry;

    if (zkCertificate.zkCertStandard === KnownZkCertStandard.ZkKYC) {
      console.log(
        'Checking HumanID Salt registry if the zkKYC can be issued...',
      );
      const saltCheckOk = await checkZkKYCSaltHashCompatibility(
        zkCertificate,
        recordRegistry as ZkKYCRegistry,
        issuer,
        hre.ethers,
      );
      if (!saltCheckOk) {
        console.log(
          'A previous salt hash has been found. Checking if it can be reset...',
        );
        const lockingZkKYCs = await listZkKYCsLockingTheSaltHash(
          zkCertificate,
          recordRegistry as ZkKYCRegistry,
          issuer,
          hre.ethers,
        );
        if (lockingZkKYCs.length > 0) {
          console.error(
            'The following zkKYCs are locking the salt hash of the zkCert:',
            JSON.stringify(lockingZkKYCs, null, 2),
          );
          throw new Error(
            'The zkCertificate cannot be issued because the salt hash is not compatible with the registered one',
          );
        } else {
          console.log(
            'No zkKYCs are locking the salt hash of the zkCert. Resetting the salt hash.',
          );
          await resetSaltHash(
            zkCertificate,
            recordRegistry as ZkKYCRegistry,
            issuer,
            hre.ethers,
          );
        }
      }
    }

    console.log('Enqueueing zkCertificate issuance operation...');
    const { registration } = await issueZkCert(
      zkCertificate,
      recordRegistry,
      issuer,
      hre.ethers.provider,
    );
    console.log(
      chalk.green(
        `Queued issuance of zkCertificate ${zkCertificate.did} on-chain at queue position ${registration.queuePosition}`,
      ),
    );

    // print to console for developers and testers, not necessary for production
    const rawJSON = {
      ...zkCertificate.exportRaw(),
      registration,
    };
    console.log(JSON.stringify(rawJSON, null, 2));

    console.log(chalk.green('This ZkCertificate can be imported in a wallet'));
    // write encrypted zkCertificate output to file
    const output = zkCertificate.exportJson(
      holderCommitmentData.encryptionPubKey,
      undefined, // merkleProof not available yet
      registration,
    );

    const outputFileName: string =
      args.outputFile ??
      `issuedZkCertificates/${zkCertificate.zkCertStandard}_${zkCertificate.leafHash}.json`;
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
    `type of zkCertificate, default to be kyc. Available options: ${JSON.stringify(
      Object.keys(flagStandardMapping),
    )}`,
    undefined,
    types.string,
    false,
  )
  .addParam(
    'randomSalt',
    'random salt, default to be randomly chosen by the system',
    undefined,
    types.string,
    true,
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
