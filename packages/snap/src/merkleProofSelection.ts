/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// SPDX-License-Identifier: BUSL-1.1
import type {
  MerkleProof,
  ZkCertRegistered,
} from '@galactica-net/galactica-types';
import { getMerkleProof as libGetMerkleProof } from '@galactica-net/zk-certificates';
import type { BaseProvider } from '@metamask/providers';
import { BrowserProvider } from 'ethers';

import { switchChain } from './utils/utils';

/**
 * Get Merkle proof for a zkCert in a registry. Fetches the merkle proof if it is in a revocable registry.
 * If the registry is non-revocable, the merkle proof is already included in the zkCert.
 *
 * @param zkCert - ZkCert to get the merkle proof for.
 * @param registryAddr - The address of the registry the zkCert is registered in.
 * @param ethereum - The Ethereum provider instance to interact with the blockchain.
 * @param [merkleServiceURL] - Optional URL of the service to fetch additional Merkle proof data.
 * @returns A Merkle proof corresponding to the provided zkCert.
 */
export async function getMerkleProof(
  zkCert: ZkCertRegistered,
  registryAddr: string,
  ethereum: BaseProvider,
  merkleServiceURL?: string,
): Promise<MerkleProof> {
  await switchChain(zkCert.registration.chainID, ethereum);
  const provider = new BrowserProvider(ethereum);
  return libGetMerkleProof(
    zkCert as any,
    registryAddr,
    provider,
    merkleServiceURL,
  );
}
