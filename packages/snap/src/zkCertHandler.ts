// SPDX-License-Identifier: BUSL-1.1
import type { EddsaPrivateKey } from '@galactica-net/galactica-types';
import type {
  ZkCertRegistered,
  ZkCertStorageHashes,
} from '@galactica-net/snap-api';
import { ImportZkCertError } from '@galactica-net/snap-api';
import {
  createHolderCommitment,
  ZkCertStandard,
} from '@galactica-net/zk-certificates';
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
export function getZkCertStorageOverview(
  zkCertStorage: ZkCertRegistered[],
): any {
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
      disclosureData.verificationLevel = zkCert.content.verificationLevel;
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

/**
 * Checks if an imported ZkCert has the right format.
 * @param zkCert - The zkCert to check.
 * @throws If the format is not correct.
 */
export function checkZkCert(zkCert: ZkCertRegistered) {
  if (!zkCert) {
    throw new ImportZkCertError({
      name: 'FormatError',
      message: 'The decrypted zkCert is invalid.',
    });
  }
  /**
   * Throws customized error for missing fields.
   * @param field - The missing field.
   */
  function complainMissingField(field: string) {
    throw new ImportZkCertError({
      name: 'FormatError',
      message: `The decrypted zkCert is invalid. It is missing the filed ${field}.`,
    });
  }
  if (!zkCert.leafHash) {
    complainMissingField('leafHash');
  }
  if (!zkCert.contentHash) {
    complainMissingField('contentHash');
  }
  if (!zkCert.providerData) {
    complainMissingField('providerData');
  }
  if (!zkCert.providerData.ax) {
    complainMissingField('providerData.ax');
  }
  if (!zkCert.providerData.ay) {
    complainMissingField('providerData.ay');
  }
  if (!zkCert.providerData.r8x) {
    complainMissingField('providerData.r8x');
  }
  if (!zkCert.providerData.r8y) {
    complainMissingField('providerData.r8y');
  }
  if (!zkCert.providerData.s) {
    complainMissingField('providerData.s');
  }
  if (!zkCert.holderCommitment) {
    complainMissingField('holderCommitment');
  }
  if (!zkCert.randomSalt) {
    complainMissingField('randomSalt');
  }
  if (!zkCert.zkCertStandard) {
    complainMissingField('zkCertStandard');
  }
  if (!zkCert.content) {
    complainMissingField('content');
  }
  if (!zkCert.registration) {
    complainMissingField('registration');
  }
  if (!zkCert.registration.address) {
    complainMissingField('registration.address');
  }
  if (zkCert.registration.revocable === undefined) {
    complainMissingField('registration.revocable');
  }
  if (zkCert.registration.leafIndex === undefined) {
    complainMissingField('registration.leafIndex');
  }
}
