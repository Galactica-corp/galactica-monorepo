// SPDX-License-Identifier: BUSL-1.1
import {
  getContentSchema,
  parseContentJson,
  type AnyZkCertContent,
  type EddsaPrivateKey,
  type KYCCertificateContent,
  type ProviderData,
  type ZkCertRegistration,
  KnownZkCertStandard,
  type ZkCertStandard,
} from '@galactica-net/galactica-types';
import type {
  ZkCertRegistered,
  ZkCertStorageHashes,
} from '@galactica-net/snap-api';
import { ImportZkCertError } from '@galactica-net/snap-api';
import { createHolderCommitment } from '@galactica-net/zk-certificates';
import type { AnySchema } from 'ajv/dist/2020';
import { buildEddsa } from 'circomlibjs';
import { keccak256 } from 'js-sha3';

/**
 * Calculates the holder commitment from the eddsa key. It is used to link a ZkCert to a holder without revealing the holder's identity to the provider.
 *
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
 *
 * @param zkCertStorage - The list of zkCerts stored.
 * @returns ZkCerts metadata listed for each zkCertStandard.
 */
export function getZkCertStorageOverview(
  zkCertStorage: ZkCertRegistered<Record<string, unknown>>[],
) {
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
    if (zkCert.zkCertStandard === KnownZkCertStandard.ZkKYC) {
      const content = zkCert.content as unknown as KYCCertificateContent;
      disclosureData.verificationLevel = content.verificationLevel;
    }
    sharedZkCerts[zkCert.zkCertStandard].push(disclosureData);
  }
  return sharedZkCerts;
}

/**
 * Provides hashes of zkCerts stored in the snap. Used to detect changes in the storage.
 *
 * @param zkCertStorage - The list of zkCerts stored.
 * @param origin - The site asking for the hash. Used as salt to prevent tracking.
 * @returns Storage hash for each zkCertStandard.
 */
export function getZkCertStorageHashes(
  zkCertStorage: ZkCertRegistered<Record<string, unknown>>[],
  origin: string,
): any {
  const storageHashes: ZkCertStorageHashes = {};
  for (const zkCert of zkCertStorage) {
    storageHashes[zkCert.zkCertStandard] ??= keccak256(origin);
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
 *
 * @param zkCert - The zkCert to check.
 * @param schema - The custom schema for the zkCert.
 * @throws If the format is not correct.
 * @returns The parsed zkCert with registration data.
 */
export function parseZkCert(
  zkCert: Record<string, unknown>,
  schema: AnySchema,
) {
  if (!zkCert) {
    throw new ImportZkCertError({
      name: 'FormatError',
      message: 'The decrypted zkCert is invalid.',
    });
  }
  /**
   * Throws customized error for missing fields.
   *
   * @param field - The missing field.
   */
  function complainMissingField(field: string) {
    throw new ImportZkCertError({
      name: 'FormatError',
      message: `The decrypted zkCert is invalid. It is missing the filed ${field}.`,
    });
  }
  // check all the fields that are required for a zkCert
  if (!zkCert.leafHash) {
    complainMissingField('leafHash');
  }
  if (!zkCert.contentHash) {
    complainMissingField('contentHash');
  }
  if (!zkCert.providerData) {
    complainMissingField('providerData');
  }
  const providerData = zkCert.providerData as ProviderData;
  if (!providerData.ax) {
    complainMissingField('providerData.ax');
  }
  if (!providerData.ay) {
    complainMissingField('providerData.ay');
  }
  if (!providerData.r8x) {
    complainMissingField('providerData.r8x');
  }
  if (!providerData.r8y) {
    complainMissingField('providerData.r8y');
  }
  if (!providerData.s) {
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
  const registration = zkCert.registration as ZkCertRegistration;
  if (!registration.address) {
    complainMissingField('registration.address');
  }
  if (registration.revocable === undefined) {
    complainMissingField('registration.revocable');
  }
  if (registration.leafIndex === undefined) {
    complainMissingField('registration.leafIndex');
  }

  try {
    parseContentJson(zkCert.content as Record<string, unknown>, schema);
  } catch (error) {
    throw new ImportZkCertError({
      name: 'FormatError',
      message: `The decrypted zkCert is invalid. The content does not fit to the schema: ${error.message}.`,
    });
  }

  return zkCert as ZkCertRegistered<AnyZkCertContent>;
}

/**
 * Chose the schema for a zkCert. If no custom schema is provided, the standard schema is used.
 *
 * @param zkCertStandard - The standard of the zkCert.
 * @param customSchema - The custom schema for the zkCert.
 * @returns The schema for the zkCert.
 */
export function choseSchema(
  zkCertStandard: ZkCertStandard,
  customSchema?: AnySchema,
) {
  if (customSchema) {
    return customSchema;
  }
  if (
    !Object.values(KnownZkCertStandard).includes(
      zkCertStandard as KnownZkCertStandard,
    )
  ) {
    throw new ImportZkCertError({
      name: 'MissingSchema',
      message: `Can not import zkCert with unknown standard ${zkCertStandard} without an attached JSON schema.`,
    });
  }
  return getContentSchema(zkCertStandard as KnownZkCertStandard);
}
