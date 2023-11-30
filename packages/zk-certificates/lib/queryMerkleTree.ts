/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { buildPoseidon } from 'circomlibjs';
import type { Contract, providers } from 'ethers';

import { printProgress } from './helpers';
import { SparseMerkleTree } from './sparseMerkleTree';
import type { KYCRecordRegistry } from '../typechain-types/contracts/KYCRecordRegistry';

/**
 * Query the on-chain Merkle tree leaves needed as input for the Merkle tree
 * @param ethers - Ethers instance
 * @param contractAddr - Address of the KYCRecordRegistry contract
 * @param firstBlock - First block to query (ideally the contract creation block)
 * @returns Promise of an array of Merkle tree leaves
 */

export type LeafLogResult = {
  leafHash: string;
  index: bigint;
};
/**
 * Get Merkle tree leaves by reading blockchain log.
 * @param provider - Ethers provider.
 * @param registry - Address of the RecordRegistry contract.
 * @param firstBlock - First block to query (optional, ideally the contract creation block).
 * @returns Promise of an LeafLogResult array of Merkle tree leaves.
 */
export async function queryOnChainLeaves(
  provider: providers.Provider,
  registry: KYCRecordRegistry,
  firstBlock = 1,
): Promise<LeafLogResult[]> {
  const currentBlock = await provider.getBlockNumber();
  const resAdded: LeafLogResult[] = [];
  const resRevoked: LeafLogResult[] = [];
  const res: LeafLogResult[] = [];

  const maxBlockInterval = 10000;
  console.log(
    `Getting Merkle tree leaves by reading blockchain log from ${firstBlock} to ${currentBlock}`,
  );

  // get logs in batches of 10000 blocks because of rpc call size limit
  for (let i = firstBlock; i < currentBlock; i += maxBlockInterval) {
    const maxBlock = Math.min(i + maxBlockInterval, currentBlock);
    // display progress in %
    printProgress(
      `${Math.round(
        ((maxBlock - firstBlock) / (currentBlock - firstBlock)) * 100,
      )}`,
    );

    // go through all logs adding a verification SBT for the user
    const leafAddedLogs = await registry.queryFilter(
      registry.filters.zkKYCRecordAddition(),
      i,
      maxBlock,
    );
    const leafRevokedLogs = await registry.queryFilter(
      registry.filters.zkKYCRecordRevocation(),
      i,
      maxBlock,
    );

    for (const log of leafAddedLogs) {
      resAdded.push({
        leafHash: BigInt(log.args[0]).toString(),
        index: BigInt(log.args[2].toString()),
      });
    }

    for (const log of leafRevokedLogs) {
      resRevoked.push({
        leafHash: BigInt(log.args[0]).toString(),
        index: BigInt(log.args[2].toString()),
      });
    }
  }

  for (const logResult of resAdded) {
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
      res.push(logResult);
    }
  }
  if (resRevoked.length > 0) {
    throw Error(
      `invalid merkle tree reconstruction: zkKYC record ${resRevoked[0].leafHash} at index ${resRevoked[0].index} has been revoked but not added`,
    );
  }
  printProgress(`100`);
  console.log(``);
  return res;
}

/**
 * Constructs a merkle tree from the leaves stored in an on-chain registry.
 * @param recordRegistry - Contract of the registry storing the Merkle tree on-chain.
 * @param provider - Ethers provider.
 * @param merkleDepth - Depth of the Merkle tree.
 * @returns Reconstructed Merkle tree.
 */
export async function buildMerkleTreeFromRegistry(
  recordRegistry: Contract,
  provider: providers.Provider,
  merkleDepth: number,
): Promise<SparseMerkleTree> {
  const leafLogResults = await queryOnChainLeaves(
    provider,
    recordRegistry as KYCRecordRegistry,
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
