import fs from 'fs';
import { ethers } from 'hardhat';
import path from 'path';

import { printProgress } from '../../lib/helpers';
import { buildMerkleTreeFromRegistry } from '../../lib/queryMerkleTree';
import { ZkCertificateRegistry } from '../../typechain-types/contracts/ZkCertificateRegistry';

/**
 * Script for creating a merkle tree for testing from a list of UTXOs, benchmark version.
 */
async function main() {
  // input
  const registryAddress = '0xa922eE97D068fd95d5692c357698F6Bf2C6fd8cE';
  const leavesToProve = [
    '6981810429802296585701394890552897013958081400319643330577058257399344841317',
  ];
  const merkleDepth = 32;

  const registry = await ethers.getContractAt(
    'ZkCertificateRegistry',
    registryAddress,
  ) as unknown as ZkCertificateRegistry;

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
