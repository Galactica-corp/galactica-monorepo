/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR ANY PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { buildPoseidon } from 'circomlibjs';
import type { Provider } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

import { SparseMerkleTree } from './sparseMerkleTree';
import type { ZkCertificateRegistry } from '../typechain-types/contracts/ZkCertificateRegistry';

/**
 * Cache structure for storing leaf log results
 */
export type LeafLogCache = {
  chainId: number;
  registryAddress: string;
  lastBlockConsidered: number;
  leafLogResults: LeafLogResult[];
};

/**
 * Configuration options for caching behavior
 */
export type CacheOptions = {
  /** Whether to enable file system caching (default: true) */
  enableFileCache?: boolean;
  /** Custom cache directory path (optional) */
  cacheDir?: string;
};

/**
 * Query the on-chain Merkle tree leaves needed as input for the Merkle tree
 *
 * @param ethers - Ethers instance
 * @param contractAddr - Address of the ZkCertificateRegistry contract
 * @param firstBlock - First block to query (ideally the contract creation block)
 * @returns Promise of an array of Merkle tree leaves
 */

export type LeafLogResult = {
  leafHash: string;
  index: bigint;
};

/**
 * Check if file system operations are available.
 *
 * @returns True if file system operations can be performed.
 */
function isFileSystemAvailable(): boolean {
  try {
    // Check if fs and path modules are available and working
    return (
      typeof fs !== 'undefined' &&
      typeof path !== 'undefined' &&
      typeof fs.existsSync === 'function' &&
      typeof fs.mkdirSync === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Get the cache file path for a specific chain and registry.
 *
 * @param chainId - The chain ID.
 * @param registryAddress - The registry contract address.
 * @param cacheDir - Custom cache directory (optional).
 * @returns The cache file path.
 */
function getCacheFilePath(
  chainId: number,
  registryAddress: string,
  cacheDir?: string,
): string {
  try {
    // Use process.cwd() as fallback for browser environments where __dirname is not available
    const g: { __dirname?: string } = globalThis as unknown as {
      __dirname?: string;
    };
    const defaultDataDir =
      typeof g.__dirname === 'undefined'
        ? path.join(process?.cwd ? process.cwd() : '.', 'data')
        : path.join(g.__dirname as string, '..', 'data');

    const dataDir = cacheDir ?? defaultDataDir;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(
      dataDir,
      `leafLogs_chain${chainId}_${registryAddress.toLowerCase()}.json`,
    );
  } catch (error) {
    console.warn('Failed to create cache directory:', error);
    throw error;
  }
}

/**
 * Load cached leaf logs if available.
 *
 * @param chainId - The chain ID.
 * @param registryAddress - The registry contract address.
 * @param cacheDir - Custom cache directory (optional).
 * @returns The cached data or null if not available.
 */
function loadCachedLeafLogs(
  chainId: number,
  registryAddress: string,
  cacheDir?: string,
): LeafLogCache | null {
  try {
    if (!isFileSystemAvailable()) {
      return null;
    }

    const cacheFilePath = getCacheFilePath(chainId, registryAddress, cacheDir);
    if (fs.existsSync(cacheFilePath)) {
      const cachedData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
      return cachedData as LeafLogCache;
    }
  } catch (error) {
    console.warn('Failed to load cached leaf logs:', error);
  }
  return null;
}

/**
 * Save leaf logs to cache.
 *
 * @param chainId - The chain ID.
 * @param registryAddress - The registry contract address.
 * @param lastBlockConsidered - The last block that was considered.
 * @param leafLogResults - The leaf log results to cache.
 * @param cacheDir - Custom cache directory (optional).
 */
function saveCachedLeafLogs(
  chainId: number,
  registryAddress: string,
  lastBlockConsidered: number,
  leafLogResults: LeafLogResult[],
  cacheDir?: string,
): void {
  try {
    if (!isFileSystemAvailable()) {
      return;
    }

    const cacheFilePath = getCacheFilePath(chainId, registryAddress, cacheDir);
    const cacheData: LeafLogCache = {
      chainId,
      registryAddress,
      lastBlockConsidered,
      leafLogResults,
    };
    fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
    console.log(`Cached leaf logs saved to ${cacheFilePath}`);
  } catch (error) {
    console.warn('Failed to save cached leaf logs:', error);
    // Don't throw - caching failure shouldn't break the main functionality
  }
}

/**
 * Get Merkle tree leaves by reading blockchain log.
 *
 * @param provider - Ethers provider.
 * @param registry - Address of the RecordRegistry contract.
 * @param firstBlock - First block to query (optional, ideally the contract creation block).
 * @param onProgress - Callback function to be called with the progress in percent.
 * @param cacheOptions - Options for caching behavior.
 * @returns Promise of an LeafLogResult array of Merkle tree leaves.
 */
export async function queryOnChainLeaves(
  provider: Provider,
  registry: ZkCertificateRegistry,
  firstBlock = 1,
  onProgress?: (percent: string) => void,
  cacheOptions: CacheOptions = {},
): Promise<LeafLogResult[]> {
  const { enableFileCache = true, cacheDir } = cacheOptions;

  const currentBlock = await provider.getBlockNumber();
  const chainId = Number(
    await provider.getNetwork().then((net) => net.chainId),
  );
  const registryAddress = await registry.getAddress();

  // Try to load cached data if caching is enabled
  let cachedData: LeafLogCache | null = null;
  if (enableFileCache) {
    cachedData = loadCachedLeafLogs(chainId, registryAddress, cacheDir);
  }

  let startBlock = firstBlock;
  let res: LeafLogResult[] = [];

  if (cachedData && cachedData.lastBlockConsidered < currentBlock) {
    console.log(
      `Using cached leaf logs from block ${firstBlock} to ${cachedData.lastBlockConsidered}`,
    );
    res = [...cachedData.leafLogResults];
    startBlock = cachedData.lastBlockConsidered + 1;
    console.log(
      `Querying additional logs from block ${startBlock} to ${currentBlock}`,
    );
  } else if (cachedData && cachedData.lastBlockConsidered >= currentBlock) {
    console.log(
      `Using cached leaf logs (up to date): ${cachedData.leafLogResults.length} leaves`,
    );
    return cachedData.leafLogResults;
  } else {
    console.log(
      `No cache found, querying all logs from block ${firstBlock} to ${currentBlock}`,
    );
  }

  const resAdded: LeafLogResult[] = [];
  const resRevoked: LeafLogResult[] = [];

  const maxBlockInterval = 10000;
  console.log(
    `Getting Merkle tree leaves by reading blockchain log from ${startBlock} to ${currentBlock}`,
  );

  // get logs in batches of 10000 blocks because of rpc call size limit
  for (let i = startBlock; i < currentBlock; i += maxBlockInterval) {
    const maxBlock = Math.min(i + maxBlockInterval, currentBlock);
    if (onProgress) {
      onProgress(
        `${Math.round(
          ((maxBlock - startBlock) / (currentBlock - startBlock)) * 100,
        )}`,
      );
    }

    // get processed certificate events (covers both add and revoke)
    let processedLogs;
    // retry on failure
    for (let errorCounter = 0; errorCounter < 5; errorCounter++) {
      try {
        const filter = registry.filters.CertificateProcessed();
        processedLogs = await registry.queryFilter(
          filter,
          i,
          maxBlock,
        );
        break;
      } catch (error) {
        console.error(error);
      }
      console.error(`retrying...`);
    }
    if (!processedLogs) {
      throw Error(
        `failed to get logs from ${i} to ${maxBlock} after 5 retries`,
      );
    }

    for (const log of processedLogs) {
      console.log("processed log merkle build", log);
      const leafHash = BigInt(log.args[0]).toString();
      // log.args[2] is RegistryOperation (0=Add,1=Revoke), log.args[4] is leafIndex
      const operation = Number(log.args[2]);
      const index = BigInt(log.args[4].toString());
      if (operation === 0) {
        resAdded.push({ leafHash, index });
      } else if (operation === 1) {
        resRevoked.push({ leafHash, index });
      }
    }
  }

  // Merge cached results with new additions first
  const allAddedLeaves = [...res, ...resAdded];

  // Process all leaves (cached + new) and check for revocations
  const finalResults: LeafLogResult[] = [];
  for (const logResult of allAddedLeaves) {
    let leafRevoked = false;
    // looping through the revocation log to see if the zkKYC record has been revoked
    for (const logResult2 of resRevoked) {
      if (
        logResult.leafHash === logResult2.leafHash &&
        logResult.index === logResult2.index
      ) {
        leafRevoked = true;
        // remove revocation from list to make sure it is not considered twice
        resRevoked.splice(resRevoked.indexOf(logResult2), 1);
        break;
      }
    }
    if (!leafRevoked) {
      finalResults.push(logResult);
    }
  }

  if (resRevoked.length > 0) {
    throw Error(
      `invalid merkle tree reconstruction: zkKYC record ${resRevoked[0].leafHash} at index ${resRevoked[0].index} has been revoked but not added`,
    );
  }

  // Save updated cache if caching is enabled
  if (enableFileCache) {
    saveCachedLeafLogs(
      chainId,
      registryAddress,
      currentBlock,
      finalResults,
      cacheDir,
    );
  }

  if (onProgress) {
    onProgress(`100`);
  }
  console.log(``);
  return finalResults;
}

/**
 * Constructs a merkle tree from the leaves stored in an on-chain registry.
 *
 * @param recordRegistry - Contract of the registry storing the Merkle tree on-chain.
 * @param provider - Ethers provider.
 * @param merkleDepth - Depth of the Merkle tree.
 * @param onProgress - Callback function to be called with the progress in percent.
 * @param cacheOptions - Options for caching behavior.
 * @returns Reconstructed Merkle tree.
 */
export async function buildMerkleTreeFromRegistry(
  recordRegistry: ZkCertificateRegistry,
  provider: Provider,
  merkleDepth: number,
  onProgress?: (percent: string) => void,
  cacheOptions: CacheOptions = {},
): Promise<SparseMerkleTree> {
  const firstBlock = Number(await recordRegistry.initBlockHeight());

  const leafLogResults = await queryOnChainLeaves(
    provider,
    recordRegistry,
    firstBlock,
    onProgress,
    cacheOptions,
  );
  const leafHashes = leafLogResults.map((value) => value.leafHash);
  const leafIndices = leafLogResults.map((value) => Number(value.index));

  const poseidon = await buildPoseidon();

  const merkleTree = new SparseMerkleTree(merkleDepth, poseidon);

  const batchSize = 10_000;
  for (let i = 0; i < leafLogResults.length; i += batchSize) {
    merkleTree.insertLeaves(
      leafHashes.slice(i, i + batchSize),
      leafIndices.slice(i, i + batchSize),
    );
  }

  return merkleTree;
}
