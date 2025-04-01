import fs from 'fs';
import { ethers } from 'hardhat';
import path from 'path';

import { printProgress } from '../lib/helpers';
import { buildMerkleTreeFromRegistry } from '../lib/queryMerkleTree';

/**
 * Script for creating a merkle tree for testing from a list of UTXOs, benchmark version.
 */
async function main() {
  // input
  const registryAddress = '0x49FEc8ddf15a9731EfeD88b35685a45e5Fa95eFE';
  const leavesToProve = [
    '1308179671240528936391414005825751669522278571022431835427338852808248413183',
  ];
  const merkleDepth = 32;

  const registry = await ethers.getContractAt(
    'ZkCertificateRegistry',
    registryAddress,
  );

  // build merkle tree
  const merkleTree = await buildMerkleTreeFromRegistry(
    registry,
    ethers.provider,
    merkleDepth,
    printProgress,
  );
  // console.log(`Merkle leaves: ${merkleTree.tree[0]}`);

  // create Merkle proofs
  for (const leaf of leavesToProve) {
    const leafIndex = merkleTree.getLeafIndex(leaf);
    const merkleProof = merkleTree.createProof(leafIndex);

    const output = {
      leaf,
      root: merkleTree.root,
      leafIndex: merkleProof.leafIndex,
      pathElements: merkleProof.pathElements,
    };

    console.log(`Merkle proof for ${leaf}:\n`, JSON.stringify(output, null, 2));

    // write proof to file for later upload in front-end
    const proofPath = `merkleProofs/${leaf}.json`;
    fs.mkdirSync(path.dirname(proofPath), { recursive: true });
    fs.writeFileSync(proofPath, JSON.stringify(output, null, 2));
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
