import { buildPoseidon } from 'circomlibjs';
import { ethers } from 'hardhat';

import { queryOnChainLeaves } from '../lib/queryMerkleTree';
import { SparseMerkleTree } from '../lib/sparseMerkleTree';

/**
 * Script for creating a merkle tree for testing from a list of UTXOs, benchmark version.
 */
async function main() {
  const registryAddress = '0xAbb654092b5BCaeca2E854550c5C972602eF7dA8';
  const leavesToProve = [
    '1587890648226949363967927358747281515927759982145649624939771519342787074806',
  ];

  // Create a new poseidon instance for hashing
  const poseidon = await buildPoseidon();

  // input
  const merkleDepth = 32;

  // build merkle tree
  const merkleTree = new SparseMerkleTree(merkleDepth, poseidon);
  const leafLogResults = await queryOnChainLeaves(ethers, registryAddress);
  const leafHashes = leafLogResults.map((log) => log.leafHash);
  const leafIndices = leafLogResults.map((log) => Number(log.index));
  const batchSize = 10_000;
  for (let i = 0; i < leafLogResults.length; i += batchSize) {
    merkleTree.insertLeaves(
      leafHashes.slice(i, i + batchSize),
      leafIndices.slice(i, i + batchSize),
    );
  }

  // console.log(`Merkle leaves: ${merkleTree.tree[0]}`);

  // create Merkle proofs
  for (const leaf of leavesToProve) {
    const leafIndex = leafIndices[leafHashes.indexOf(leaf)];
    const merkleProof = merkleTree.createProof(leafIndex);

    const output = {
      leaf,
      root: merkleTree.root,
      leafIndex: merkleProof.leafIndex,
      pathElements: merkleProof.path,
    };

    console.log(`Merkle proof for ${leaf}:\n`, JSON.stringify(output, null, 2));
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
