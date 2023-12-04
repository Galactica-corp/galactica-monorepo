/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import type {
  MerkleProof,
  ZkCertRegistration,
} from '@galactica-net/galactica-types';
import type { Signer, Contract } from 'ethers';

import { fromDecToHex, fromHexToBytes32 } from './helpers';
import type { SparseMerkleTree } from './sparseMerkleTree';
import type { ZKCertificate } from './zkCertificate';

/**
 * Issues zkCert record on-chain and updates the merkle tree.
 * @param zkCert - ZKCertificate to issue on-chain.
 * @param recordRegistry - Record registry contract.
 * @param issuer - Issuer of the zkCert (guardian).
 * @param merkleTree - Merkle tree of the registry (passed to not reconstruct it repeatedly).
 * @returns MerkleProof of the new leaf in the tree and registration data.
 */
export async function issueZkCert(
  zkCert: ZKCertificate,
  recordRegistry: Contract,
  issuer: Signer,
  merkleTree: SparseMerkleTree,
): Promise<{ merkleProof: MerkleProof; registration: ZkCertRegistration }> {
  const leafBytes = fromHexToBytes32(fromDecToHex(zkCert.leafHash));

  const chosenLeafIndex = merkleTree.getFreeLeafIndex();
  const leafEmptyMerkleProof = merkleTree.createProof(chosenLeafIndex);

  // now we have the merkle proof to add a new leaf
  const tx = await recordRegistry.connect(issuer).addZkKYCRecord(
    chosenLeafIndex,
    leafBytes,
    leafEmptyMerkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    ),
  );
  await tx.wait();

  // update the merkle tree according to the new leaf
  merkleTree.insertLeaves([zkCert.leafHash], [chosenLeafIndex]);
  const leafInsertedMerkleProof = merkleTree.createProof(chosenLeafIndex);

  return {
    merkleProof: leafInsertedMerkleProof,
    registration: {
      address: recordRegistry.address,
      revocable: true,
      leafIndex: chosenLeafIndex,
    },
  };
}

/**
 * Revokes zkCert record on-chain and updates the merkle tree.
 * @param zkCertLeafHash - Leaf hash of the zkCert to revoke.
 * @param leafIndex - Index of the zkCert to revoke.
 * @param recordRegistry - Record registry contract.
 * @param issuer - Issuer of the zkCert (= guardian allowed to revoke).
 * @param merkleTree - Merkle tree of the registry (passed to not reconstruct it repeatedly).
 */
export async function revokeZkCert(
  zkCertLeafHash: string,
  leafIndex: number,
  recordRegistry: Contract,
  issuer: Signer,
  merkleTree: SparseMerkleTree,
) {
  if (merkleTree.retrieveLeaf(0, leafIndex) !== zkCertLeafHash) {
    throw Error('Incorrect leaf hash at the input index.');
  }
  const leafHashAsBytes = fromHexToBytes32(fromDecToHex(zkCertLeafHash));
  if (
    (await recordRegistry.ZKKYCRecordToCenter(leafHashAsBytes)) !==
    (await issuer.getAddress())
  ) {
    throw Error('Only the issuer of the zkCert can revoke it.');
  }

  const merkleProof = merkleTree.createProof(leafIndex);

  const tx = await recordRegistry.connect(issuer).revokeZkKYCRecord(
    leafIndex,
    leafHashAsBytes,
    merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    ),
  );
  await tx.wait();

  // update the merkle tree according to the new leaf
  merkleTree.insertLeaves([merkleTree.emptyLeaf], [leafIndex]);
}
