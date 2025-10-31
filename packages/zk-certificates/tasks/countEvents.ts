/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import {
  dateStringFromTimestamp,
  findBlockByTimestamp,
  timestampFromString,
} from '../lib/blockTimestampUtils';
import { getEventTopicHash, getLogs } from '../lib/eventQueryUtils';
import type { ZkCertificateRegistry } from '../typechain-types/contracts/ZkCertificateRegistry';

const DEFAULT_BLOCK_INTERVAL = 10000; // Default block interval to avoid RPC limits

/**
 * Task for counting events emitted by a contract within a specified time range.
 *
 * @param args - See task definition below or 'npx hardhat countEvents --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  const { registryAddress } = args;
  const { startTime } = args;
  const { endTime } = args;
  const eventSignature =
    args.eventSignature ?? 'zkCertificateAddition(bytes32,address,uint256)';

  console.log(`Counting events for contract: ${registryAddress}`);
  console.log(`Event: ${eventSignature}`);
  console.log(`Time range: ${startTime} to ${endTime}`);

  // Convert time strings to timestamps
  const startTimestamp = timestampFromString(startTime);
  const endTimestamp = timestampFromString(endTime);

  if (startTimestamp >= endTimestamp) {
    throw new Error('Start time must be before end time');
  }

  console.log(
    `Time range: ${dateStringFromTimestamp(
      startTimestamp,
    )} to ${dateStringFromTimestamp(endTimestamp)}`,
  );

  // Get contract instance
  const registry = (await hre.ethers.getContractAt(
    'ZkCertificateRegistry',
    registryAddress,
  )) as unknown as ZkCertificateRegistry;

  // Get init block height if available (for optimization)
  let initBlock: number | undefined;
  try {
    const initBlockHeight = await registry.initBlockHeight();
    initBlock = Number(initBlockHeight);
    console.log(`Contract initialized at block: ${initBlock}`);
  } catch {
    console.log('Could not get initBlockHeight, using block 0 as start');
  }

  // Find block numbers for start and end times using binary search
  console.log('Finding start block...');
  const startBlock = await findBlockByTimestamp(
    hre,
    startTimestamp,
    initBlock ?? 0,
  );
  const startBlockData = await hre.ethers.provider.getBlock(startBlock);
  console.log(
    `Start block: ${startBlock} (timestamp: ${dateStringFromTimestamp(
      Number(startBlockData?.timestamp),
    )})`,
  );

  console.log('Finding end block...');
  const endBlock = await findBlockByTimestamp(hre, endTimestamp, startBlock);
  const endBlockData = await hre.ethers.provider.getBlock(endBlock);
  console.log(
    `End block: ${endBlock} (timestamp: ${dateStringFromTimestamp(
      Number(endBlockData?.timestamp),
    )})`,
  );

  // Get event topic hash
  const eventTopicHash = getEventTopicHash(registry, eventSignature);

  // Query events
  const blockInterval = args.blockInterval ?? DEFAULT_BLOCK_INTERVAL;
  const logs = await getLogs(
    hre,
    registry,
    eventTopicHash,
    startBlock,
    endBlock,
    blockInterval,
  );

  // Parse and display results
  const count = logs.length;
  console.log(`\nTotal events found in time range: ${count}`);

  if (count > 0) {
    // Try to parse the first event as a sample
    try {
      const firstLog = logs[0];
      const parsedLog = registry.interface.parseLog({
        topics: firstLog.topics as string[],
        data: firstLog.data,
      });
      console.log('Sample event:', {
        name: parsedLog?.name,
        args: parsedLog?.args,
        blockNumber: firstLog.blockNumber,
      });
    } catch {
      console.log('Could not parse sample event');
    }
  }

  console.log('done');
}

task('countEvents', 'Count events emitted by a contract within a time range')
  .addParam(
    'registryAddress',
    'The contract address to query events from',
    undefined,
    types.string,
    false,
  )
  .addParam(
    'startTime',
    'Start time as human-readable string (e.g., "2024-01-01" or "January 1, 2024")',
    undefined,
    types.string,
    false,
  )
  .addParam(
    'endTime',
    'End time as human-readable string (e.g., "2024-12-31" or "December 31, 2024")',
    undefined,
    types.string,
    false,
  )
  .addParam(
    'eventSignature',
    'Full event signature (e.g., "CertificateProcessed(bytes32,address,uint8,uint256,uint256)") or event name',
    'CertificateProcessed(bytes32,address,uint8,uint256,uint256)',
    types.string,
    true,
  )
  .addParam(
    'blockInterval',
    'Block interval for querying logs to avoid RPC limits',
    DEFAULT_BLOCK_INTERVAL,
    types.int,
    true,
  )
  .setAction(async (taskArgs, hre) => {
    await main(taskArgs, hre).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
