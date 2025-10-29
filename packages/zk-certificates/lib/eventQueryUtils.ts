/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { id, type Log } from 'ethers';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

/**
 * Get event topic hash from either a full event signature string or event name.
 *
 * @param contract - The contract instance with interface.
 * @param eventSignature - Full event signature (e.g., "zkCertificateAddition(bytes32,address,uint256)") or event name.
 * @returns The event topic hash.
 */
export function getEventTopicHash(
  contract: { interface: any },
  eventSignature: string,
): string {
  // Check if the signature contains parentheses (indicating full signature)
  if (eventSignature.includes('(')) {
    // It's a full signature, compute the topic hash directly
    return id(eventSignature);
  }

  // Try to get the event by name from the contract interface
  try {
    const eventFragment = contract.interface.getEvent(eventSignature);
    return eventFragment.topicHash;
  } catch (error) {
    throw new Error(
      `Event "${eventSignature}" not found in contract interface. Please provide the full event signature (e.g., "EventName(type1,type2)")`,
    );
  }
}

/**
 * Get logs from a contract in a range of blocks, handling RPC block range limits.
 *
 * @param hre - Hardhat runtime environment.
 * @param contract - The contract instance.
 * @param eventTopicHash - The topic hash of the event to query.
 * @param startBlock - The block number to start fetching logs from.
 * @param endBlock - The block number to stop fetching logs at.
 * @param blockInterval - The interval of blocks to fetch logs in (to avoid RPC limits).
 * @returns The raw logs.
 */
export async function getLogs(
  hre: HardhatRuntimeEnvironment,
  contract: { getAddress: () => Promise<string>; interface: any },
  eventTopicHash: string,
  startBlock: number,
  endBlock: number,
  blockInterval: number,
): Promise<Log[]> {
  console.log(`Fetching events from block ${startBlock} to ${endBlock}`);
  console.log(`Using block intervals of ${blockInterval} blocks`);

  // Initialize array to store all logs
  const allLogs: Log[] = [];

  // Process blocks in chunks to avoid RPC limitations
  for (
    let fromBlock = startBlock;
    fromBlock <= endBlock;
    fromBlock += blockInterval
  ) {
    const toBlock = Math.min(fromBlock + blockInterval - 1, endBlock);

    const progress =
      100 -
      ((endBlock - fromBlock) / (endBlock - startBlock + 1)) * 100;
    console.log(
      `Fetching events from block ${fromBlock} to ${toBlock} (${progress.toFixed(1)}%)`,
    );

    // Query for events in the current block range
    let events: Log[] = [];
    let retries = 0;
    const maxRetries = 3;
    while (retries <= maxRetries) {
      try {
        events = await hre.ethers.provider.getLogs({
          address: await contract.getAddress(),
          topics: [eventTopicHash],
          fromBlock,
          toBlock,
        });
        break;
      } catch (error: any) {
        console.error(
          `Error fetching logs (attempt ${retries + 1}/${maxRetries + 1}):`,
          error.message,
        );
        if (retries === maxRetries) {
          throw error;
        }
        retries += 1;
        console.log(`Retrying in 5 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    allLogs.push(...events);

    // Wait for 200ms to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`Total events found: ${allLogs.length}`);

  return allLogs;
}

