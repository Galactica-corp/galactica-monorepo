// SPDX-License-Identifier: BUSL-1.1
import type {
  MerkleProof,
  ZkCertRegistered,
} from '@galactica-net/galactica-types';
import { GenericError } from '@galactica-net/snap-api';
import {
  fromHexToDec,
  getMerkleRootFromProof,
} from '@galactica-net/zk-certificates';
import type { BaseProvider } from '@metamask/providers';
import { buildPoseidon } from 'circomlibjs';
import type { Address } from 'viem';
import { getContract } from 'viem';

import { kycRecordRegistryABI } from './config/abi/kycRecordRegistry';
import { fetchWithTimeout, switchChain } from './utils/utils';
import { getWalletClient } from './utils/getWalletClient';

const MERKLE_PROOF_SERVICE_PATH = 'merkle/proof/';

/**
 * Get Merkle proof for a zkCert in a registry. Fetches the merkle proof if it is ina revocable registry.
 * If the registry is non-revocable, the merkle proof is already included in the zkCert.
 * @param zkCert - ZkCert to get the merkle proof for.
 * @param registryAddr - Address of the registry the zkCert is registered in.
 * @param ethereum - Ethereum provider to read from the blockchain.
 * @param merkleServiceURL - URL of the node to fetch the merkle proof from (optional).
 * @returns Merkle proof for the zkCert.
 */
export async function getMerkleProof(
  zkCert: ZkCertRegistered,
  registryAddr: string,
  ethereum: BaseProvider,
  merkleServiceURL?: string,
): Promise<MerkleProof> {
  if (!zkCert.registration.revocable) {
    // non-revocable registries, can also accept proofs for previous roots, so we can just use the old one
    return zkCert.merkleProof;
  }

  await switchChain(zkCert.registration.chainID, ethereum);
  const wc = await getWalletClient();
  const registry = getContract({
    client: wc,
    abi: kycRecordRegistryABI,
    address: registryAddr as Address,
  });
  const poseidon = await buildPoseidon();

  // make sure the MerkleProof format is correct until inconsistency is solved
  if (zkCert.merkleProof.pathElements === undefined) {
    if ((zkCert.merkleProof as any).path === undefined) {
      throw new GenericError({
        name: 'MerkleProofUpdateFailed',
        message: `Merkle proof is missing path`,
      });
    }
    zkCert.merkleProof.pathElements = (zkCert.merkleProof as any).path;
  }
  if (zkCert.merkleProof.leafIndex === undefined) {
    if ((zkCert.merkleProof as any).leaf === undefined) {
      throw new GenericError({
        name: 'MerkleProofUpdateFailed',
        message: `Merkle proof is missing index`,
      });
    }
    zkCert.merkleProof.leafIndex = (zkCert.merkleProof as any).index;
  }

  if (
    fromHexToDec(await registry.read.merkleRoot()) ===
    getMerkleRootFromProof(zkCert.merkleProof, poseidon)
  ) {
    // The merkle root is the same as the one in the zkCert, so we can just use the old one
    return zkCert.merkleProof;
  }

  // Because the registry is revocable, the merkle tree has probably changed since last time the zkCert was issued/used.
  // Therefore, we need to fetch the merkle proof from the node or regenerate the tree to calculate it.
  let merkleProofFetchURL = merkleServiceURL ?? getDefaultMerkleServiceURL();
  merkleProofFetchURL += `${zkCert.registration.chainID.toString()}/${
    MERKLE_PROOF_SERVICE_PATH + zkCert.registration.address
  }/${zkCert.leafHash}`;

  try {
    const response = await fetchWithTimeout(merkleProofFetchURL);

    if (!response.ok) {
      throw new GenericError({
        name: 'MerkleProofUpdateFailed',
        message: `Merkle proof fetch failed with status ${response.status}: ${response.statusText}`,
      });
    }

    const resJson = await response.json();
    if (
      resJson.proof === undefined ||
      resJson.proof.index === undefined ||
      resJson.proof.path === undefined
    ) {
      throw new GenericError({
        name: 'MerkleProofUpdateFailed',
        message: `MerkleUpdate response is missing required fields: ${JSON.stringify(
          resJson,
        )}`,
      });
    }

    // Format into MerkleProof object
    const merkleProof: MerkleProof = {
      leaf: zkCert.leafHash,
      pathElements: resJson.proof.path,
      leafIndex: resJson.proof.index,
    };
    return merkleProof;
  } catch (error) {
    throw new GenericError({
      name: 'MerkleProofUpdateFailed',
      message: `Merkle proof fetch failed with error "${
        error.message as string
      }"`,
    });
  }
}

/**
 * Gets the node URL from the ethereum provider to fetch non-EVM data from.
 * @returns URL as string.
 */
function getDefaultMerkleServiceURL(): string {
  // Placeholder until more decentralized and customizable solution is in place.
  // In principle every Galactica node could be addressed.
  // We provide a default here because Metamask does not disclose the URL used for the RPC calls.
  return 'https://merkle-proof-service.galactica.com/v1/galactica/';
}
