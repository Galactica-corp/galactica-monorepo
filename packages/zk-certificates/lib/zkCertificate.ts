/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type {
  AuthorizationProofInput,
  EncryptedZkCert,
  FraudInvestigationDataEncryptionProofInput,
  HumanIDProofInput,
  MerkleProof,
  OwnershipProofInput,
  ProviderData,
  ZkCertData,
  ZkCertRegistration,
  ZkCertStandard,
  EddsaPrivateKey,
} from '@galactica-net/galactica-types';
import {
  eddsaPrimeFieldMod,
  ENCRYPTION_VERSION,
  humanIDFieldOrder,
  zkKYCContentFields,
} from '@galactica-net/galactica-types';
import { encryptSafely } from '@metamask/eth-sig-util';
import type { Eddsa, Point, Poseidon } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';
import { Scalar } from 'ffjavascript';

import { formatPrivKeyForBabyJub } from './keyManagement';
import { encryptFraudInvestigationData } from './SBTData';

/**
 * Class for managing and constructing zkCertificates, the generalized version of zkKYC.
 * Specification can be found here: https://docs.google.com/document/d/16R_CI7oj-OqRoIm6Ipo9vEpUQmgaVv7fL2yI4NTX9qw/edit?pli=1#heading=h.ah3xat5fhvac .
 */
export class ZKCertificate implements ZkCertData {
  // Field of the curve used by Poseidon
  protected poseidon: Poseidon;

  protected fieldPoseidon: any;

  readonly holderCommitment: string;

  public zkCertStandard: ZkCertStandard;

  protected eddsa: Eddsa;

  public randomSalt: number;

  public content: Record<string, any>;

  public providerData: ProviderData;

  /**
   * Create a ZKCertificate.
   * @param holderCommitment - Commitment fixing the holder eddsa key without revealing it to the provider.
   * @param zkCertStandard - ZkCert standard to use.
   * @param eddsa - EdDSA instance to use for signing.
   * @param randomSalt - Random salt randomizing the zkCert.
   * @param content - ZKCertificate parameters, can be set later.
   * @param providerData - Provider data, can be set later.
   */
  constructor(
    holderCommitment: string,
    zkCertStandard: ZkCertStandard, // TODO: move enum from snap here
    eddsa: Eddsa,
    randomSalt: number,
    content: Record<string, any> = {}, // standardize field definitions
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
    this.content = content;
    this.providerData = providerData;
  }

  get contentHash(): string {
    return this.poseidon.F.toObject(
      this.poseidon(
        zkKYCContentFields.map((field) => this.content[field]),
        undefined,
        1,
      ),
    ).toString();
  }

  get leafHash(): string {
    return this.poseidon.F.toObject(
      this.poseidon(
        [
          this.contentHash,
          this.providerData.ax,
          this.providerData.ay,
          this.providerData.s,
          this.providerData.r8x,
          this.providerData.r8y,
          this.holderCommitment,
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

  public setContent(content: Record<string, any>) {
    this.content = content;
  }

  /**
   * Export the encrypted zkCert as a JSON string that can be imported in the Galactica Snap for Metamask.
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

    const encryptedData = encryptSafely({
      publicKey: encryptionPubKey,
      data: dataToExport,
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
   * @returns ZkCertData object.
   */
  public exportRaw(): ZkCertData {
    const doc = {
      holderCommitment: this.holderCommitment,
      leafHash: this.leafHash,
      did: this.did,
      zkCertStandard: this.zkCertStandard,
      content: this.content,
      contentHash: this.contentHash,
      providerData: this.providerData,
      randomSalt: this.randomSalt,
    };
    return doc;
  }

  /**
   * Create the input for the ownership proof of this zkCert.
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

  /**
   * Calculate dApp specific human ID from zkKYC and dApp address.
   * @param dAppAddress - Address of the dApp.
   * @returns Human ID as string.
   */
  public getHumanID(dAppAddress: string): string {
    return this.poseidon.F.toObject(
      this.poseidon(
        // fill needed fields from zkKYC with dAppAddress added at the correct place
        humanIDFieldOrder.map((field) =>
          field === 'dAppAddress' ? dAppAddress : this.content[field],
        ),
        undefined,
        1,
      ),
    ).toString();
  }

  public getHumanIDProofInput(
    dAppAddress: string,
    passportID: string,
  ): HumanIDProofInput {
    return {
      dAppAddress,
      passportID,
      humanID: this.getHumanID(dAppAddress),
    };
  }
}
