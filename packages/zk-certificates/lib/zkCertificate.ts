/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import type {
  AnyZkCertContent,
  AuthorizationProofInput,
  EddsaPrivateKey,
  EncryptedZkCert,
  FraudInvestigationDataEncryptionProofInput,
  MerkleProof,
  OwnershipProofInput,
  ProviderData,
  ZkCertData,
  ZkCertRegistered,
  ZkCertRegistration,
  ZkCertStandard,
} from '@galactica-net/galactica-types';
import {
  eddsaPrimeFieldMod,
  ENCRYPTION_VERSION,
  getContentSchema,
  parseContentJson,
  KnownZkCertStandard,
} from '@galactica-net/galactica-types';
import { encryptSafely } from '@metamask/eth-sig-util';
import type { AnySchema } from 'ajv/dist/2020';
import type { Eddsa, Point, Poseidon } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';
import { Scalar } from 'ffjavascript';

import { formatPrivKeyForBabyJub } from './keyManagement';
import { encryptFraudInvestigationData } from './SBTData';
import { hashZkCertificateContent } from './zkCertificateDataProcessing';

/**
 * Class for managing and constructing zkCertificates, the generalized version of zkKYC.
 * Specification can be found here: https://docs.google.com/document/d/16R_CI7oj-OqRoIm6Ipo9vEpUQmgaVv7fL2yI4NTX9qw/edit?pli=1#heading=h.ah3xat5fhvac .
 */
export class ZkCertificate<Content = AnyZkCertContent>
  implements ZkCertData<Content>
{
  // Field of the curve used by Poseidon
  public poseidon: Poseidon;

  protected fieldPoseidon: any;

  readonly holderCommitment: string;

  public zkCertStandard: ZkCertStandard;

  public eddsa: Eddsa;

  public randomSalt: string;

  public expirationDate: number;

  public content: Content;

  public contentSchema: AnySchema;

  public providerData: ProviderData;

  /**
   * Create a ZkCertificate.
   *
   * @param holderCommitment - Commitment fixing the holder eddsa key without revealing it to the provider.
   * @param zkCertStandard - ZkCert standard to use.
   * @param eddsa - EdDSA instance to use for signing.
   * @param randomSalt - Random salt randomizing the zkCert.
   * @param expirationDate - Expiration date of the zkCert.
   * @param contentSchema - JSON Schema of the content containing information about the fields and how to provide them to the zk circuit.
   * @param content - ZkCertificate content, this is the data being attested to.
   * @param providerData - Provider data, can be set later.
   */
  constructor(
    holderCommitment: string,
    zkCertStandard: ZkCertStandard,
    eddsa: Eddsa,
    randomSalt: string,
    expirationDate: number,
    contentSchema: AnySchema,
    content: Record<string, unknown>,
    providerData: ProviderData = {
      ax: '0',
      ay: '0',
      s: '0',
      r8x: '0',
      r8y: '0',
    },
  ) {
    this.holderCommitment = holderCommitment;
    this.zkCertStandard = zkCertStandard;
    this.poseidon = eddsa.poseidon;
    this.fieldPoseidon = this.poseidon.F;
    this.eddsa = eddsa;
    this.randomSalt = randomSalt;
    this.expirationDate = expirationDate;
    this.content = parseContentJson<Content>(content, contentSchema);
    this.contentSchema = contentSchema;
    this.providerData = providerData;
  }

  get contentHash(): string {
    return hashZkCertificateContent(
      this.eddsa,
      this.content,
      this.contentSchema,
    );
  }

  get leafHash(): string {
    return this.poseidon.F.toObject(
      this.poseidon(
        [
          this.contentHash,
          this.expirationDate,
          this.holderCommitment,
          this.providerData.ax,
          this.providerData.ay,
          this.providerData.r8x,
          this.providerData.r8y,
          this.providerData.s,
          this.randomSalt,
        ],
        undefined,
        1,
      ),
    ).toString();
  }

  get providerMessage(): string {
    return this.poseidon.F.toObject(
      this.poseidon([this.contentHash, this.holderCommitment], undefined, 1),
    ).toString();
  }

  get did(): string {
    return `did:${this.zkCertStandard}:${this.leafHash}`;
  }

  public setContent(content: Record<string, unknown>) {
    this.content = parseContentJson<Content>(content, this.contentSchema);
  }

  /**
   * Export the encrypted zkCert as a JSON string that can be imported in the Galactica Snap for Metamask.
   *
   * @param encryptionPubKey - Public key of the holder used for encryption.
   * @param merkleProof - Merkle proof to attach to the zkCert (optional).
   * @param registration - Registration data to attach to the zkCert (optional).
   * @returns JSON string of the encrypted zkCert.
   */
  public exportJson(
    encryptionPubKey: string,
    merkleProof?: MerkleProof,
    registration?: ZkCertRegistration,
  ): string {
    const dataToExport = this.exportRaw() as any;
    if (merkleProof) {
      dataToExport.merkleProof = merkleProof;
    }
    if (registration) {
      dataToExport.registration = registration;
    }
    // sort data to make it match the way it is parsed later
    const sortedDataToExport = Object.keys(dataToExport)
      .sort()
      .reduce((acc: any, key: string) => {
        acc[key] = dataToExport[key];
        return acc;
      }, {});
    const encryptedData = encryptSafely({
      publicKey: encryptionPubKey,
      data: sortedDataToExport,
      version: ENCRYPTION_VERSION,
    });
    const encryptedZkCert: EncryptedZkCert = {
      ...encryptedData,
      holderCommitment: this.holderCommitment,
    };
    return JSON.stringify(encryptedZkCert, null, 2);
  }

  /**
   * Export the unencrypted zkCert as object containing only the fields relevant for import in a wallet.
   *
   * @returns ZkCertData object.
   */
  public exportRaw(): ZkCertData<Content> {
    const doc = {
      content: this.content,
      contentHash: this.contentHash,
      did: this.did,
      expirationDate: this.expirationDate,
      holderCommitment: this.holderCommitment,
      leafHash: this.leafHash,
      providerData: this.providerData,
      randomSalt: this.randomSalt,
      zkCertStandard: this.zkCertStandard,
    };
    return doc;
  }

  /**
   * Create the input for the ownership proof of this zkCert.
   *
   * @param holderKey - EdDSA Private key of the holder.
   * @returns OwnershipProofInput struct.
   */
  public getOwnershipProofInput(
    holderKey: EddsaPrivateKey,
  ): OwnershipProofInput {
    const holderPubKeyEddsa = this.eddsa.prv2pub(holderKey);
    const hashPubkey: bigint = this.fieldPoseidon.toObject(
      this.poseidon([holderPubKeyEddsa[0], holderPubKeyEddsa[1]]),
    );
    // take modulo of hash to get it into the mod field supported by eddsa
    const hashPubkeyMsg = this.fieldPoseidon.e(
      Scalar.mod(hashPubkey, eddsaPrimeFieldMod),
    );
    const signature = this.eddsa.signPoseidon(holderKey, hashPubkeyMsg);

    // self check
    if (
      !this.eddsa.verifyPoseidon(hashPubkeyMsg, signature, holderPubKeyEddsa)
    ) {
      throw new Error('Self check on EdDSA signature failed');
    }

    return {
      holderCommitment: this.holderCommitment,
      // public key of the holder
      ax: this.fieldPoseidon.toObject(holderPubKeyEddsa[0]).toString(),
      ay: this.fieldPoseidon.toObject(holderPubKeyEddsa[1]).toString(),
      // signature of the holder
      s: signature.S.toString(),
      r8x: this.fieldPoseidon.toObject(signature.R8[0]).toString(),
      r8y: this.fieldPoseidon.toObject(signature.R8[1]).toString(),
    };
  }

  /**
   * Create the input for the provider signature check of this zkCert.
   *
   * @param providerKey - EdDSA Private key of the KYC provider.
   * @returns ProviderData struct.
   */
  public signWithProvider(providerKey: EddsaPrivateKey): ProviderData {
    const providerPubKeyEddsa = this.eddsa.prv2pub(providerKey);
    const message: bigint = this.fieldPoseidon.toObject(
      this.poseidon([this.contentHash, this.holderCommitment]),
    );
    // take modulo of the message to get it into the mod field supported by eddsa
    const messageMod = this.fieldPoseidon.e(
      Scalar.mod(message, eddsaPrimeFieldMod),
    );
    const signature = this.eddsa.signPoseidon(providerKey, messageMod);

    // self check
    if (
      !this.eddsa.verifyPoseidon(messageMod, signature, providerPubKeyEddsa)
    ) {
      throw new Error('Self check on EdDSA signature failed');
    }

    this.providerData = {
      // public key of the provider
      ax: this.fieldPoseidon.toObject(providerPubKeyEddsa[0]).toString(),
      ay: this.fieldPoseidon.toObject(providerPubKeyEddsa[1]).toString(),
      // signature of the provider
      s: signature.S.toString(),
      r8x: this.fieldPoseidon.toObject(signature.R8[0]).toString(),
      r8y: this.fieldPoseidon.toObject(signature.R8[1]).toString(),
    };
    return this.providerData;
  }

  /**
   * Create the input for the authorization proof of this zkCert.
   *
   * @param holderKey - EdDSA Private key of the holder.
   * @param userAddress - User address to be signed.
   * @returns AuthorizationProofInput struct.
   */
  public getAuthorizationProofInput(
    holderKey: EddsaPrivateKey,
    userAddress: string,
  ): AuthorizationProofInput {
    // we include the 0x prefix so the address has length 42 in hexadecimal
    if (userAddress.length !== 42) {
      throw new Error('Incorrect address length');
    }

    // we don't need to hash the user address because of the length making it less than 2**160, hence less than the field prime value.
    const userAddressField = this.fieldPoseidon.e(userAddress);
    const signature = this.eddsa.signPoseidon(holderKey, userAddressField);

    // self check
    const holderPubKeyEddsa = this.eddsa.prv2pub(holderKey);
    if (
      !this.eddsa.verifyPoseidon(userAddressField, signature, holderPubKeyEddsa)
    ) {
      throw new Error('Self check on EdDSA signature failed');
    }

    return {
      userAddress,
      // public key of the holder
      ax: this.fieldPoseidon.toObject(holderPubKeyEddsa[0]).toString(),
      ay: this.fieldPoseidon.toObject(holderPubKeyEddsa[1]).toString(),
      // signature of the holder
      s: signature.S.toString(),
      r8x: this.fieldPoseidon.toObject(signature.R8[0]).toString(),
      r8y: this.fieldPoseidon.toObject(signature.R8[1]).toString(),
    };
  }

  /**
   * Create the input for the fraud investigation data encryption proof of this zkCert.
   *
   * @param institutionPub - EdDSA Public encryption key of the institution.
   * @param userPrivKey - EdDSA Private encryption key of the holder.
   * @returns Input for FraudInvestigationProof.
   */
  public async getFraudInvestigationDataEncryptionProofInput(
    institutionPub: Point,
    userPrivKey: EddsaPrivateKey,
  ): Promise<FraudInvestigationDataEncryptionProofInput> {
    const eddsa = await buildEddsa();
    const userPub = eddsa.prv2pub(userPrivKey);
    const institutionPubKey = institutionPub.map((param: any) =>
      eddsa.poseidon.F.toObject(param).toString(),
    );

    return {
      userPrivKey: formatPrivKeyForBabyJub(userPrivKey, eddsa).toString(),
      userPubKey: userPub.map((param: any) =>
        eddsa.poseidon.F.toObject(param).toString(),
      ),
      investigationInstitutionPubkey: institutionPubKey,
      encryptedData: await encryptFraudInvestigationData(
        institutionPub,
        userPrivKey,
        this.providerData.ax,
        this.leafHash,
      ),
    };
  }
}

/**
 * Mapping of zkCert standard names to their respective enum values.
 */
export const flagStandardMapping: Record<string, KnownZkCertStandard> = {
  zkKYC: KnownZkCertStandard.ZkKYC,
  data: KnownZkCertStandard.ArbitraryData,
  twitter: KnownZkCertStandard.Twitter,
  rey: KnownZkCertStandard.Rey,
  cex: KnownZkCertStandard.CEX,
  dex: KnownZkCertStandard.DEX,
  telegram: KnownZkCertStandard.Telegram,
  blum: KnownZkCertStandard.Blum,
};

/**
 * Choose the schema for a zkCert. If no custom schema is provided, the standard schema is used.
 *
 * @param standard - The standard of the zkCert.
 * @param schema - Optional custom schema to use.
 * @returns The schema for the zkCert.
 * @throws Error If the standard is not recognized and no custom schema is provided.
 */
export function chooseSchema(
  standard: ZkCertStandard,
  schema?: AnySchema,
): AnySchema {
  if (
    !Object.values(KnownZkCertStandard).includes(
      standard as KnownZkCertStandard,
    )
  ) {
    if (!schema) {
      throw new Error(
        `Cannot import zkCert with unknown standard ${standard} without an attached JSON schema.`,
      );
    }

    return schema;
  }

  return getContentSchema(standard as KnownZkCertStandard);
}

/**
 * Parses {@link ZkCertRegistered} from raw data.
 *
 * @param zkCert - The zkCert to check.
 * @param schema - The custom schema for the zkCert.
 * @throws If the format is not correct.
 * @returns The parsed zkCert with registration data.
 * @throws Error If the {@link ZkCertRegistered} can't be parsed.
 */
export function parseZkCert(
  zkCert: Record<string, unknown>,
  schema: AnySchema,
): ZkCertRegistered<Record<string, unknown>> {
  if (!zkCert) {
    throw new Error('The zkCert is invalid.');
  }
  /**
   * Throws customized error for missing fields.
   *
   * @param field - The missing field.
   */
  function complainMissingField(field: string) {
    throw new Error(`The zkCert is invalid. It is missing the filed ${field}.`);
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
  if (registration.queuePosition === undefined) {
    complainMissingField('registration.queuePosition');
  }

  try {
    const parsedCert = {
      content: parseContentJson<Record<string, unknown>>(
        zkCert.content as Record<string, unknown>,
        schema,
      ),
      contentHash: zkCert.contentHash,
      did: zkCert.did,
      expirationDate: zkCert.expirationDate,
      holderCommitment: zkCert.holderCommitment,
      leafHash: zkCert.leafHash,
      merkleProof: zkCert.merkleProof,
      providerData: zkCert.providerData,
      randomSalt: zkCert.randomSalt,
      registration: zkCert.registration,
      zkCertStandard: zkCert.zkCertStandard,
    } as ZkCertRegistered<Record<string, unknown>>; // BUG: This function must ensure that the type is correct in compile time.

    if (!zkCert.merkleProof) {
      // deleting the merkleProof field to avoid comparison errors between {} and {merkleProof: undefined}
      delete parsedCert.merkleProof;
    }
    return parsedCert;
  } catch (error) {
    const message = error instanceof Error ? error.message : `${String(error)}`;
    throw new Error(
      `The zkCert is invalid. The content does not fit to the schema: ${message}.`,
    );
  }
}
