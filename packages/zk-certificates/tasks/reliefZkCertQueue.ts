/* Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { ZkCertStandard } from '@galactica-net/galactica-types';
import { KnownZkCertStandard } from '@galactica-net/galactica-types';
import chalk from 'chalk';
import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import { fromDecToHex, fromHexToBytes32, printProgress } from '../lib/helpers';
import { buildMerkleTreeFromRegistry } from '../lib/queryMerkleTree';
import { flagStandardMapping } from '../lib/zkCertificate';
import type { GuardianRegistry } from '../typechain-types/contracts/GuardianRegistry';
import type { OwnableBatcher } from '../typechain-types/contracts/OwnableBatcher';
import type { ZkCertificateRegistry } from '../typechain-types/contracts/ZkCertificateRegistry';
import type { ZkKYCRegistry } from '../typechain-types/contracts/ZkKYCRegistry';

/**
 * Task for issuing all zkCerts that are stuck in the queue.
 *
 * @param args - See task definition below or 'npx hardhat reliefZkCertQueue --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  console.log('Relieving zkCert queue');

  const [issuer] = await hre.ethers.getSigners();
  console.log(
    `Using provider ${chalk.yellow(
      issuer.address.toString(),
    )} to sign the zkCertificate`,
  );

  const zkCertificateType: ZkCertStandard =
    flagStandardMapping[args.zkCertificateType];

  const recordRegistry = (await hre.ethers.getContractAt(
    zkCertificateType === KnownZkCertStandard.ZkKYC
      ? 'ZkKYCRegistry'
      : 'ZkCertificateRegistry',
    args.registryAddress,
  )) as unknown as ZkCertificateRegistry | ZkKYCRegistry;

  console.log(
    'Reconstructing the Merkle tree. This might take a while because it needs to query on-chain data...',
  );
  const merkleTreeDepth = await recordRegistry.treeDepth();
  const merkleTree = await buildMerkleTreeFromRegistry(
    recordRegistry as ZkCertificateRegistry,
    hre.ethers.provider,
    Number(merkleTreeDepth),
    printProgress,
  );

  // iterate over the queue until all zkCerts are issued
  let nextZkCertIndex = await recordRegistry.currentQueuePointer();
  let nextZkCertHash = await recordRegistry.ZkCertificateQueue(nextZkCertIndex);
  const batcher = (await hre.ethers.getContractAt(
    'OwnableBatcher',
    args.batcherAddress,
  )) as unknown as OwnableBatcher;

  // whitelist the batcher as guardian address
  // @ts-expect-error dynamic access until typechain updates
  const guardianRegistryAddress = await (recordRegistry as any).guardianRegistry();
  const guardianRegistry = (await hre.ethers.getContractAt(
    'GuardianRegistry',
    guardianRegistryAddress,
  )) as unknown as GuardianRegistry;
  if (!(await guardianRegistry.isWhitelisted(args.batcherAddress))) {
    // whitelist the batcher as guardian address
    await guardianRegistry
      .connect(issuer)
      .addIssuerAccount(args.batcherAddress);
  }

  type Call = {
    target: string;
    callData: string;
  };

  const BATCH_SIZE = 16;

  while (
    nextZkCertHash !==
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    // collect hashes for the next batch
    console.log(
      `Collecting queue item ${nextZkCertIndex} to ${nextZkCertIndex + BigInt(BATCH_SIZE)}`,
    );
    const batchPromises: Promise<string>[] = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      batchPromises.push(
        recordRegistry.ZkCertificateQueue(nextZkCertIndex + BigInt(i)),
      );
    }
    const zkCertHashes = await Promise.all(batchPromises);

    // collect merkle proofs and calls for the batch
    const callData: Call[] = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const chosenLeafIndex = merkleTree.getFreeLeafIndex();
      const leafEmptyMerkleProof = merkleTree.createProof(chosenLeafIndex);

      // processNextOperation for both Add and Revoke operations; here we assume queued Add operations
      callData.push({
        target: args.registryAddress,
        callData: (recordRegistry as ZkCertificateRegistry).interface.encodeFunctionData(
          'processNextOperation',
          [
            chosenLeafIndex,
            zkCertHashes[i],
            leafEmptyMerkleProof.pathElements.map((value) =>
              fromHexToBytes32(fromDecToHex(value)),
            ),
          ],
        ),
      });

      // update the local merkle tree so that the next zkCert will get a correct merkle proof again
      merkleTree.insertLeaf(
        BigInt(zkCertHashes[i]).toString(),
        chosenLeafIndex,
      );
    }

    // execute the calls
    const tx = await batcher.batchCalls(callData, {
      gasLimit: 40000000,
    });
    // make sure the local provider keeps up with the changes on chain
    await tx.wait();

    nextZkCertIndex += BigInt(BATCH_SIZE);
    try {
      nextZkCertHash = await recordRegistry.ZkCertificateQueue(nextZkCertIndex);
    } catch (error) {
      console.log(
        chalk.red(`Error getting next zkCert hash: ${JSON.stringify(error)}`),
      );
      break;
    }
  }

  console.log(chalk.green('done'));
}

task('reliefZkCertQueue', 'Task to relieve a zkCertificate queue')
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
    'batcherAddress',
    'The smart contract address where the batcher is deployed',
    undefined,
    types.string,
    false,
  )
  .setAction(async (taskArgs, hre) => {
    await main(taskArgs, hre).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
