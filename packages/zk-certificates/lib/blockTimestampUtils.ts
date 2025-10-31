/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import type { HardhatEthersHelpers } from '@nomicfoundation/hardhat-ethers/types';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

/**
 * Extended HardhatRuntimeEnvironment with ethers support.
 * The @nomicfoundation/hardhat-ethers plugin adds the ethers property at runtime.
 */
type HardhatRuntimeEnvironmentWithEthers = HardhatRuntimeEnvironment & {
  ethers: HardhatEthersHelpers;
};

/**
 * Convert a date string to a timestamp.
 *
 * @param dateString - The date string to convert.
 * @returns The timestamp in seconds.
 */
export function timestampFromString(dateString: string): number {
  const date = new Date(Date.parse(dateString));

  if (isNaN(date.getTime())) {
    throw new Error(
      `Invalid date string: "${dateString}". Please use a valid date format (e.g. "2024-03-21" or "March 21, 2024")`,
    );
  }

  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert a timestamp to a human readable date string.
 *
 * @param timestamp - The Unix timestamp in seconds.
 * @returns A human readable date string.
 */
export function dateStringFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Find the block number closest to (but not exceeding) a target timestamp using binary search.
 *
 * @param hre - Hardhat runtime environment.
 * @param targetTimestamp - The target Unix timestamp in seconds.
 * @param startBlock - Optional starting block number for search (default: 0).
 * @param endBlock - Optional ending block number for search (default: current block).
 * @returns The block number with timestamp closest to (but not exceeding) the target timestamp.
 */
export async function findBlockByTimestamp(
  hre: HardhatRuntimeEnvironmentWithEthers,
  targetTimestamp: number,
  startBlock?: number,
  endBlock?: number,
): Promise<number> {
  // Get current block if endBlock not provided
  const { provider } = hre.ethers;
  const actualEndBlock = endBlock ?? (await provider.getBlockNumber());

  // Use 0 as default start block if not provided
  const actualStartBlock = startBlock ?? 0;

  // Check if target is before the first block
  const startBlockData = await provider.getBlock(actualStartBlock);
  if (!startBlockData) {
    throw new Error(`Block ${actualStartBlock} not found`);
  }
  if (targetTimestamp < startBlockData.timestamp) {
    return actualStartBlock;
  }

  // Check if target is after the last block
  const endBlockData = await provider.getBlock(actualEndBlock);
  if (!endBlockData) {
    throw new Error(`Block ${actualEndBlock} not found`);
  }
  if (targetTimestamp >= endBlockData.timestamp) {
    return actualEndBlock;
  }

  // Binary search for the block
  let low = actualStartBlock;
  let high = actualEndBlock;
  let result = actualStartBlock;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midBlock = await provider.getBlock(mid);
    if (!midBlock) {
      throw new Error(`Block ${mid} not found`);
    }

    if (midBlock.timestamp <= targetTimestamp) {
      // This block is at or before the target timestamp
      result = mid;
      low = mid + 1; // Search in the upper half
    } else {
      // This block is after the target timestamp
      high = mid - 1; // Search in the lower half
    }
  }

  return result;
}
