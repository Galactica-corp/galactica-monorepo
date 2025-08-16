/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// SPDX-License-Identifier: BUSL-1.1
import {
  type EddsaPrivateKey,
  type KYCCertificateContent,
  ZkCertStandard,
} from '@galactica-net/galactica-types';
import type {
  ZkCertRegistered,
  ZkCertStorageHashes,
} from '@galactica-net/snap-api';
import { createHolderCommitment } from '@galactica-net/zk-certificates';
import { buildEddsa } from 'circomlibjs';
import { keccak256 } from 'js-sha3';

/**
 * Calculates the holder commitment from the eddsa key. It is used to link a ZkCert to a holder without revealing the holder's identity to the provider.
 * @param holderEddsaKey - The eddsa key of the holder.
 * @returns Calculated holder commitment.
 */
export async function calculateHolderCommitment(
  holderEddsaKey: EddsaPrivateKey,
): Promise<string> {
  // use holder commitment function from zkkyc module (calculated on zkCert construction)
  return createHolderCommitment(await buildEddsa(), holderEddsaKey);
}

/**
 * Provides an overview of the zkCert storage. This data can be queried by front-ends.
 * The data shared here must not reveal any private information or possibility to track users).
 * @param zkCertStorage - The list of zkCerts stored.
 * @returns ZkCerts metadata listed for each zkCertStandard.
 */
export function getZkCertStorageOverview(zkCertStorage: ZkCertRegistered[]) {
  const sharedZkCerts: any = {};
  for (const zkCert of zkCertStorage) {
    if (sharedZkCerts[zkCert.zkCertStandard] === undefined) {
      sharedZkCerts[zkCert.zkCertStandard] = [];
    }

    const disclosureData: any = {
      providerPubKey: {
        ax: zkCert.providerData.ax,
        ay: zkCert.providerData.ay,
      },
      expirationDate: zkCert.expirationDate,
    };
    if (zkCert.zkCertStandard === ZkCertStandard.ZkKYC) {
      const content = zkCert.content as KYCCertificateContent;
      disclosureData.verificationLevel = content.verificationLevel;
    }
    sharedZkCerts[zkCert.zkCertStandard].push(disclosureData);
  }
  return sharedZkCerts;
}

/**
 * Provides hashes of zkCerts stored in the snap. Used to detect changes in the storage.
 * @param zkCertStorage - The list of zkCerts stored.
 * @param origin - The site asking for the hash. Used as salt to prevent tracking.
 * @returns Storage hash for each zkCertStandard.
 */
export function getZkCertStorageHashes(
  zkCertStorage: ZkCertRegistered[],
  origin: string,
): any {
  const storageHashes: ZkCertStorageHashes = {};
  for (const zkCert of zkCertStorage) {
    if (storageHashes[zkCert.zkCertStandard] === undefined) {
      storageHashes[zkCert.zkCertStandard] = keccak256(origin);
    }
    storageHashes[zkCert.zkCertStandard] = keccak256(
      (storageHashes[zkCert.zkCertStandard] as string) +
        zkCert.leafHash +
        zkCert.registration.address +
        zkCert.registration.chainID,
    );
  }
  return storageHashes;
}
