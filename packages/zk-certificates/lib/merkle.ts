/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import type {
  MerkleProof,
  ZkCertRegistered,
} from '@galactica-net/galactica-types';
import { buildPoseidon } from 'circomlibjs';
import { type AbstractProvider, Contract } from 'ethers';

import { fromHexToDec, getMerkleRootFromProof } from '.';

const MERKLE_PROOF_SERVICE_PATH = 'merkle/proof/';

/**
 * Fetches or verifies the Merkle proof for a given zkCert based on its registration status and validity against the registry.
 *
 * @param zkCert - The zero-knowledge certificate object that contains registration and proof data.
 * @param registryAddr - The address of the registry smart contract storing the Merkle root.
 * @param provider - The provider interface for blockchain interaction (e.g., ethers.js provider).
 * @param [merkleServiceURL] - Optional URL of the service to fetch an updated Merkle proof. If not provided, a default service URL is used.
 * @returns Returns a Merkle proof that includes the leaf hash, path elements, and leaf index, which can be used to prove membership in the Merkle tree.
 */
export async function getMerkleProof(
  zkCert: ZkCertRegistered<Record<string, unknown>>,
  registryAddr: string,
  provider: AbstractProvider,
  merkleServiceURL?: string,
): Promise<MerkleProof> {
  if (!zkCert.registration.revocable) {
    return zkCert.merkleProof;
  }

  const registry = new Contract(
    registryAddr,
    ['function merkleRoot() external view returns (bytes32)'],
    provider,
  );
  const poseidon = await buildPoseidon();

  if (
    (zkCert.merkleProof as any).path !== undefined &&
    zkCert.merkleProof.pathElements === undefined
  ) {
    zkCert.merkleProof.pathElements = (zkCert.merkleProof as any).path;
  }
  if (
    (zkCert.merkleProof as any).index !== undefined &&
    zkCert.merkleProof.leafIndex === undefined
  ) {
    zkCert.merkleProof.leafIndex = (zkCert.merkleProof as any).index;
  }

  const currentRoot = await registry.merkleRoot();
  if (
    fromHexToDec(currentRoot) ===
    getMerkleRootFromProof(zkCert.merkleProof, poseidon)
  ) {
    return zkCert.merkleProof;
  }

  let merkleProofFetchURL = merkleServiceURL ?? getDefaultMerkleServiceURL();
  merkleProofFetchURL += `${zkCert.registration.chainID.toString()}/${MERKLE_PROOF_SERVICE_PATH + zkCert.registration.address}/${zkCert.leafHash}`;

  const response = await fetch(merkleProofFetchURL);
  if (!response.ok) {
    throw new Error(
      `Merkle proof fetch failed with status ${response.status}: ${response.statusText}`,
    );
  }

  const resJson: any = await response.json();
  if (
    !resJson.proof ||
    resJson.proof.index === undefined ||
    resJson.proof.path === undefined
  ) {
    throw new Error(
      `MerkleUpdate response is missing required fields: ${JSON.stringify(resJson)}`,
    );
  }

  return {
    leaf: zkCert.leafHash,
    pathElements: resJson.proof.path,
    leafIndex: resJson.proof.index,
  };
}

/**
 * Retrieves the default URL for the Merkle Service.
 *
 * @returns The default URL for the Merkle Service API.
 */
export function getDefaultMerkleServiceURL(): string {
  return 'https://merkle-proof-service.galactica.com/v1/galactica/';
}
