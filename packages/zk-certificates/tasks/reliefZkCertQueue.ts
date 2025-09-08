/* Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { ZkCertStandard } from '@galactica-net/galactica-types';
import { KnownZkCertStandard } from '@galactica-net/galactica-types';
import chalk from 'chalk';
import type { ContractTransactionResponse } from 'ethers';
import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import {
  fromDecToHex,
  fromHexToBytes32,
  printProgress,
  sleep,
} from '../lib/helpers';
import { buildMerkleTreeFromRegistry } from '../lib/queryMerkleTree';
import { flagStandardMapping } from '../lib/zkCertificate';
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

  while (
    nextZkCertHash !==
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    console.log(
      `Issuing queue item ${nextZkCertIndex}, hash: ${nextZkCertHash}`,
    );

    const chosenLeafIndex = merkleTree.getFreeLeafIndex();
    const leafEmptyMerkleProof = merkleTree.createProof(chosenLeafIndex);

    if (zkCertificateType === KnownZkCertStandard.ZkKYC) {
      throw new Error(
        'ZkKYC queue processing not possible without HumanID Salt.',
      );
      // await recordRegistry.connect(issuer).addZkKYC(
      //   chosenLeafIndex,
      //   nextZkCertHash,
      //   leafEmptyMerkleProof.pathElements.map((value) =>
      //     fromHexToBytes32(fromDecToHex(value)),
      //   ),
      //   getIdHash(zkCert),
      //   zkCert.holderCommitment,
      //   zkCert.expirationDate,
      // );
    } else {
      const tx = (await recordRegistry.connect(issuer).addZkCertificate(
        chosenLeafIndex,
        nextZkCertHash,
        leafEmptyMerkleProof.pathElements.map((value) =>
          fromHexToBytes32(fromDecToHex(value)),
        ),
        { gasLimit: 2200000 },
      )) as ContractTransactionResponse;
      await tx.wait();
    }
    // sleep to make sure the local provider keeps up with the changes on chain
    await sleep(3);

    // update the local merkle tree so that the next zkCert will get a correct merkle proof again
    merkleTree.insertLeaves(
      [BigInt(nextZkCertHash).toString()],
      [chosenLeafIndex],
    );

    console.log(
      chalk.green(
        `Issued the zkCertificate certificate ${nextZkCertHash} on chain at index ${chosenLeafIndex}`,
      ),
    );

    nextZkCertIndex += 1n;
    nextZkCertHash = await recordRegistry.ZkCertificateQueue(nextZkCertIndex);
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
  .setAction(async (taskArgs, hre) => {
    await main(taskArgs, hre).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
