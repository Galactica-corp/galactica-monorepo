/* Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import chalk from 'chalk';
import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import { fromDecToHex, fromHexToBytes32, printProgress } from '../lib/helpers';
import { buildMerkleTreeFromRegistry } from '../lib/queryMerkleTree';
import type { ZkCertificateRegistry } from '../typechain-types/contracts/ZkCertificateRegistry';

/**
 * Simple queue processor for ZkCertificateRegistry that continuously processes queue operations.
 * Supports both issuance and revocation operations.
 *
 * @param args - See task definition below or 'npx hardhat simpleQueueProcessor --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  console.log('Starting Simple Queue Processor for ZkCertificateRegistry...');

  const [issuer] = await hre.ethers.getSigners();
  console.log(
    `Using provider ${chalk.yellow(
      issuer.address.toString(),
    )} to process queue operations`,
  );

  const recordRegistry = (await hre.ethers.getContractAt(
    'ZkCertificateRegistry',
    args.registryAddress,
  )) as unknown as ZkCertificateRegistry;

  console.log(
    'Reconstructing the Merkle tree. This might take a while because it needs to query on-chain data...',
  );
  const merkleTreeDepth = await recordRegistry.treeDepth();
  const merkleTree = await buildMerkleTreeFromRegistry(
    recordRegistry,
    hre.ethers.provider,
    Number(merkleTreeDepth),
    printProgress,
  );

  let isServiceRunning = true;

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    isServiceRunning = false;
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    isServiceRunning = false;
  });

  console.log(chalk.green('Queue processor started successfully'));
  console.log('Press Ctrl+C to stop the service');

  // Main processing loop, waiting for SIGINT or SIGTERM to stop it
  // eslint-disable-next-line no-unmodified-loop-condition
  while (isServiceRunning) {
    try {
      // Get current queue pointer
      const currentQueuePointer = await recordRegistry.currentQueuePointer();
      const queueLength = await recordRegistry.getZkCertificateQueueLength();

      // Check if there are items to process
      if (currentQueuePointer >= queueLength) {
        // No items to process, wait a bit before checking again
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      // Get the next queue item
      const nextZkCertHash =
        await recordRegistry.ZkCertificateQueue(currentQueuePointer);

      if (
        nextZkCertHash ===
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      ) {
        // No more items to process
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      console.log(
        `Processing queue item ${currentQueuePointer}: ${nextZkCertHash}`,
      );

      // Get operation data to determine if it's an addition or revocation
      const operationData =
        await recordRegistry.zkCertificateProcessingData(nextZkCertHash);

      let chosenLeafIndex: number;
      let merkleProof: string[];

      if (operationData.state === 1n /** IssuanceQueued */) {
        // For addition operations, find a free leaf and create proof for empty leaf
        chosenLeafIndex = merkleTree.getFreeLeafIndex();
        const leafEmptyMerkleProof = merkleTree.createProof(chosenLeafIndex);
        merkleProof = leafEmptyMerkleProof.pathElements.map((value) =>
          fromHexToBytes32(fromDecToHex(value)),
        );
      } else if (operationData.state === 3n /** RevocationQueued */) {
        // For revocation operations, find the leaf containing the certificate hash
        chosenLeafIndex = merkleTree.getLeafIndex(
          BigInt(nextZkCertHash).toString(),
        );
        const leafMerkleProof = merkleTree.createProof(chosenLeafIndex);
        merkleProof = leafMerkleProof.pathElements.map((value) =>
          fromHexToBytes32(fromDecToHex(value)),
        );
      } else {
        throw new Error(
          `Certificate ${nextZkCertHash} found in unexpected state ${operationData.state}`,
        );
      }

      // Process the operation
      const tx = await recordRegistry.processNextOperation(
        chosenLeafIndex,
        nextZkCertHash,
        merkleProof,
        {
          gasLimit: 5000000,
        },
      );

      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(
        chalk.green(`Successfully processed queue item ${currentQueuePointer}`),
      );

      // Update the local merkle tree
      if (operationData.state === 1n /** IssuanceQueued */) {
        merkleTree.insertLeaf(
          BigInt(nextZkCertHash).toString(),
          chosenLeafIndex,
        );
      } else {
        // For revocation operations, insert the empty leaf at the chosen index
        merkleTree.insertLeaf(merkleTree.emptyLeaf, chosenLeafIndex);
      }

      // Small delay before processing next item
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(
        chalk.red(`Error processing queue: ${JSON.stringify(error)}`),
      );
      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log(chalk.green('Queue processor stopped'));
}

task(
  'simpleQueueProcessor',
  'Simple queue processor for ZkCertificateRegistry that continuously processes queue operations',
)
  .addParam(
    'registryAddress',
    'The smart contract address where zkCertificates are registered',
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
