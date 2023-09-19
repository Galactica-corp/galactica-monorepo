// SPDX-License-Identifier: BUSL-1.1
import { MerkleProof, ZkCertRegistered } from '@galactica-net/galactica-types';
import { BaseProvider } from '@metamask/providers';
import { Contract, providers } from 'ethers';


/**
 * Get Merkle proof for a zkCert in a registry. Fetches the merkle proof if it is ina revocable registry.
 * If the registry is non-revocable, the merkle proof is already included in the zkCert.
 * 
 * @param zkCert - ZkCert to get the merkle proof for.
 * @param registryAddr - Address of the registry the zkCert is registered in.
 * @param ethereum - Ethereum provider to read from the blockchain.
 * @returns Merkle proof for the zkCert.
 */
export function getMerkleProof(zkCert: ZkCertRegistered, registryAddr: string, ethereum: BaseProvider): MerkleProof {
  if (!zkCert.registration.revocable) {
    // non-revocable registries, can also accept proofs for previous roots, so we can just use the old one
    return zkCert.merkleProof;
  }

  const provider = new providers.Web3Provider(ethereum);
  const registry = new Contract(registryAddr, ['function merkleRoot() external view returns (bytes32)'], provider);
  if (registry.merkleRoot() == zkCert.merkleProof.root) {
    // The merkle root is the same as the one in the zkCert, so we can just use the old one
    return zkCert.merkleProof;
  }

  // Because the registry is revocable, the merkle tree has probably changed since last time the zkCert was issued/used.
  // Therefore, we need to fetch the merkle proof from the node or regenerate the tree to calculate it.

  throw new Error('Fetch Merkle Proof Not implemented');
}