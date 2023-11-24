// SPDX-License-Identifier: BUSL-1.1
import { MerkleProof, ZkCertRegistered } from '@galactica-net/galactica-types';
import { GenericError } from '@galactica-net/snap-api';
import { fromHexToDec } from '@galactica-net/zk-certificates';
import { BaseProvider } from '@metamask/providers';
import { Contract, providers } from 'ethers';

import { fetchWithTimeout } from './utils';

const MERKLE_PROOF_SERVICE_PATH = 'merkle/proof/';

/**
 * Get Merkle proof for a zkCert in a registry. Fetches the merkle proof if it is ina revocable registry.
 * If the registry is non-revocable, the merkle proof is already included in the zkCert.
 *
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

  const provider = new providers.Web3Provider(ethereum);
  const registry = new Contract(
    registryAddr,
    ['function merkleRoot() external view returns (bytes32)'],
    provider,
  );
  if (fromHexToDec(await registry.merkleRoot()) === zkCert.merkleProof.root) {
    // The merkle root is the same as the one in the zkCert, so we can just use the old one
    return zkCert.merkleProof;
  }

  // Because the registry is revocable, the merkle tree has probably changed since last time the zkCert was issued/used.
  // Therefore, we need to fetch the merkle proof from the node or regenerate the tree to calculate it.
  let merkleProofFetchURL = merkleServiceURL ?? getDefaultMerkleServiceURL();
  merkleProofFetchURL += `/${
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
      resJson.root === undefined ||
      resJson.indices === undefined ||
      resJson.path === undefined
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
      root: resJson.root,
      leaf: zkCert.leafHash,
      pathElements: resJson.path,
      leafIndex: resJson.indices,
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
 *
 * @returns URL as string.
 */
function getDefaultMerkleServiceURL(): string {
  // Placeholder for more decentralized and customizable solution
  // The problem is that Metamask does not disclose the URL used for the RPC calls, so we need to find another way to get it or let the user customize it.
  return 'https://test-node.galactica.com:1317';
}
