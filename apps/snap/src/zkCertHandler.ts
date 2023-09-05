// SPDX-License-Identifier: BUSL-1.1
import {
  SharedZkCert,
  RegisteredZkCert,
  ZkCertStandard,
} from '@galactica-net/core';
import { createHolderCommitment } from '@galactica-net/zkkyc';
import { buildEddsa } from 'circomlibjs';
import { keccak256 } from 'js-sha3';

/**
 * Calculates the holder commitment from the eddsa key. It is used to link a ZkCert to a holder without revealing the holder's identity to the provider.
 *
 * @param holderEddsaKey - The eddsa key of the holder.
 */
export async function calculateHolderCommitment(
  holderEddsaKey: string,
): Promise<string> {
  // use holder commitment function from zkkyc module (calculated on zkCert construction)
  return createHolderCommitment(await buildEddsa(), holderEddsaKey);
}

/**
 * Provides an overview of the zkCert storage. This data can be queried by front-ends.
 * The data shared here must not reveal any private information or possibility to track users).
 *
 * @param zkCertStorage - The list of zkCerts stored.
 * @returns ZkCerts metadata listed for each zkCertStandard.
 */
export function getZkCertStorageOverview(zkCertStorage: RegisteredZkCert[]) {
  return zkCertStorage.reduce((result, zkCert) => {
    const disclosureData: SharedZkCert = {
      providerPubKey: {
        ax: zkCert.providerData.ax,
        ay: zkCert.providerData.ay,
      },
      verificationLevel:
        zkCert.zkCertStandard === 'gip69'
          ? zkCert.content.verificationLevel
          : undefined,
      expirationDate:
        zkCert.zkCertStandard === 'gip69'
          ? zkCert.content.expirationDate
          : undefined,
    };

    if (!result[zkCert.zkCertStandard]) result[zkCert.zkCertStandard] = [];

    result[zkCert.zkCertStandard].push(disclosureData);

    return result;
  }, {} as Record<ZkCertStandard, SharedZkCert[]>);
}

/**
 * Provides hashes of zkCerts stored in the snap. Used to detect changes in the storage.
 *
 * @param zkCertStorage - The list of zkCerts stored.
 * @param origin - The site asking for the hash. Used as salt to prevent tracking.
 * @returns Storage hash for each zkCertStandard.
 */
export function calcZkCertStorageHashes(
  zkCertStorage: RegisteredZkCert[],
  origin: string,
) {
  return zkCertStorage.reduce((result, zkCert) => {
    const zkCertStandard = zkCert.zkCertStandard;

    const hash = result[zkCertStandard] ?? keccak256(origin);

    result[zkCertStandard] = hash + JSON.stringify(zkCert);

    return result;
  }, {} as Record<ZkCertStandard, string>);
}
