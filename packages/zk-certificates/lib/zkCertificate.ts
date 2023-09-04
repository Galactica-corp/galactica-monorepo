/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { Scalar } from 'ffjavascript';

import { formatPrivKeyForBabyJub } from './keyManagement';
import { encryptFraudInvestigationData } from './SBTData';
import { buildEddsa } from 'circomlibjs';
import {
  eddsaPrimeFieldMod,
  OwnershipProofInput,
  AuthorizationProofInput,
  ProviderData,
  FraudInvestigationDataEncryptionProofInput,
  HumanIDProofInput,
  ZkCertData,
  ZkCertStandard,
  humanIDFieldOrder,
  zkKYCContentFields,
} from "@galactica-net/galactica-types";

/**
 * @description Class for managing and constructing zkCertificates, the generalized version of zkKYC.
 * @dev specification can be found here: https://docs.google.com/document/d/16R_CI7oj-OqRoIm6Ipo9vEpUQmgaVv7fL2yI4NTX9qw/edit?pli=1#heading=h.ah3xat5fhvac
 */
export class ZKCertificate implements ZkCertData {
  // Field of the curve used by Poseidon
  protected poseidon: any;
  protected fieldPoseidon: any;

  /**
   * @description Create a ZKCertificate
   *
   * @param holderCommitment commitment fixing the holder eddsa key without revealing it to the provider
   * @param zkCertStandard zkCert standard to use
   * @param eddsa eddsa instance to use for signing
   * @param randomSalt random salt randomizing the zkCert
   * @param content ZKCertificate parameters, can be set later
   * @param providerData provider data, can be set later
   *
   * @param content ZKCertificate parameters, can be set later
   */
  constructor(
    readonly holderCommitment: string,
    public zkCertStandard: ZkCertStandard, // TODO: move enum from snap here
    protected eddsa: any,
    public randomSalt: number,
    public content: Record<string, any> = {}, // standardize field definitions
    public providerData: ProviderData = {
      ax: '0',
      ay: '0',
      s: '0',
      r8x: '0',
      r8y: '0',
    }
  ) {
    this.poseidon = eddsa.poseidon;
    this.fieldPoseidon = this.poseidon.F;
  }

  get contentHash(): string {
    return this.poseidon.F.toObject(
      this.poseidon(
        zkKYCContentFields.map((field) => this.content[field]),
        undefined,
        1
      )
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
        1
      )
    ).toString();
  }

  get providerMessage(): string {
    return this.poseidon.F.toObject(
      this.poseidon([this.contentHash, this.holderCommitment], undefined, 1)
    ).toString();
  }

  get did(): string {
    return `did:${this.zkCertStandard}:${this.leafHash}`;
  }

  public setContent(content: Record<string, any>) {
    this.content = content;
  }

  /**
   * Export the zkCert as a JSON string that can be imported in the Galactica Snap for Metamask
   * TODO: add encryption option
   * @returns JSON string
   */
  public exportJson(): string {
    return JSON.stringify(this.export(), null, 2);
  }

  /**
   * Export the zkCert as object containing only the fields relevant for import in a wallet
   * @returns ZkCert object
   */
  public export(): any {
    const doc = {
      holderCommitment: this.holderCommitment,
      leafHash: this.leafHash,
      did: this.did,
      zkCertStandard: this.zkCertStandard,
      content: this.content,
      providerData: this.providerData,
      randomSalt: this.randomSalt,
    };
    return doc;
  }

  /**
   * @description Create the input for the ownership proof of this zkCert
   *
   * @param holderKey EdDSA Private key of the holder
   * @returns OwnershipProofInput struct
   */
  public getOwnershipProofInput(holderKey: string): OwnershipProofInput {
    const holderPubKeyEddsa = this.eddsa.prv2pub(holderKey);
    const hashPubkey: BigInt = this.fieldPoseidon.toObject(
      this.poseidon([holderPubKeyEddsa[0], holderPubKeyEddsa[1]])
    );
    // take modulo of hash to get it into the mod field supported by eddsa
    const hashPubkeyMsg = this.fieldPoseidon.e(
      Scalar.mod(hashPubkey, eddsaPrimeFieldMod)
    );
    const sig = this.eddsa.signPoseidon(holderKey, hashPubkeyMsg);

    // selfcheck
    if (!this.eddsa.verifyPoseidon(hashPubkeyMsg, sig, holderPubKeyEddsa)) {
      throw new Error('Self check on EdDSA signature failed');
    }

    return {
      holderCommitment: this.holderCommitment,
      // public key of the holder
      ax: this.fieldPoseidon.toObject(holderPubKeyEddsa[0]).toString(),
      ay: this.fieldPoseidon.toObject(holderPubKeyEddsa[1]).toString(),
      // signature of the holder
      s: sig.S.toString(),
      r8x: this.fieldPoseidon.toObject(sig.R8[0]).toString(),
      r8y: this.fieldPoseidon.toObject(sig.R8[1]).toString(),
    };
  }
  /**
   * @description Create the input for the provider signature check of this zkCert
   *
   * @param providerKey EdDSA Private key of the KYC provider
   * @returns ProviderData struct
   */
  public signWithProvider(providerKey: string): ProviderData {
    const providerPubKeyEddsa = this.eddsa.prv2pub(providerKey);
    const message: BigInt = this.fieldPoseidon.toObject(
      this.poseidon([this.contentHash, this.holderCommitment])
    );
    // take modulo of the message to get it into the mod field supported by eddsa
    const messageMod = this.fieldPoseidon.e(
      Scalar.mod(message, eddsaPrimeFieldMod)
    );
    const sig = this.eddsa.signPoseidon(providerKey, messageMod);

    // selfcheck
    if (!this.eddsa.verifyPoseidon(messageMod, sig, providerPubKeyEddsa)) {
      throw new Error('Self check on EdDSA signature failed');
    }

    this.providerData = {
      // public key of the provider
      ax: this.fieldPoseidon.toObject(providerPubKeyEddsa[0]).toString(),
      ay: this.fieldPoseidon.toObject(providerPubKeyEddsa[1]).toString(),
      // signature of the provider
      s: sig.S.toString(),
      r8x: this.fieldPoseidon.toObject(sig.R8[0]).toString(),
      r8y: this.fieldPoseidon.toObject(sig.R8[1]).toString(),
    };
    return this.providerData;
  }

  /**
   * @description Create the input for the authorization proof of this zkCert
   *
   * @param holderKey EdDSA Private key of the holder
   * @param userAddress user address to be signed
   * @returns AuthorizationProofInput struct
   */
  public getAuthorizationProofInput(
    holderKey: string,
    userAddress: string
  ): AuthorizationProofInput {
    // we include the 0x prefix so the address has length 42 in hexadecimal
    if (userAddress.length !== 42) {
      throw new Error('Incorrect address length');
    }

    // we don't need to hash the user address because of the length making it less than 2**160, hence less than the field prime value.
    const userAddress_ = this.fieldPoseidon.e(userAddress);
    const sig = this.eddsa.signPoseidon(holderKey, userAddress_);

    // selfcheck
    const holderPubKeyEddsa = this.eddsa.prv2pub(holderKey);
    if (!this.eddsa.verifyPoseidon(userAddress, sig, holderPubKeyEddsa)) {
      throw new Error('Self check on EdDSA signature failed');
    }

    return {
      userAddress: userAddress,
      // public key of the holder
      ax: this.fieldPoseidon.toObject(holderPubKeyEddsa[0]).toString(),
      ay: this.fieldPoseidon.toObject(holderPubKeyEddsa[1]).toString(),
      // signature of the holder
      s: sig.S.toString(),
      r8x: this.fieldPoseidon.toObject(sig.R8[0]).toString(),
      r8y: this.fieldPoseidon.toObject(sig.R8[1]).toString(),
    };
  }

  /**
   * @description Create the input for the fraud investigation data encryption proof of this zkCert
   *
   * @param galaInstitutionPubKey
   * @param userPrivKey
   * @param providerPubKey
   * @param zkCertHash
   * @returns
   */
  public async getFraudInvestigationDataEncryptionProofInput(
    institutionPub: string[],
    userPrivKey: string
  ): Promise<FraudInvestigationDataEncryptionProofInput> {
    const eddsa = await buildEddsa();
    const userPub = eddsa.prv2pub(userPrivKey);
    const institutionPubKey = institutionPub.map((p: any) =>
      eddsa.poseidon.F.toObject(p).toString()
    );

    return {
      userPrivKey: formatPrivKeyForBabyJub(userPrivKey, eddsa).toString(),
      userPubKey: userPub.map((p: any) =>
        eddsa.poseidon.F.toObject(p).toString()
      ),
      investigationInstitutionPubkey: institutionPubKey,
      encryptedData: await encryptFraudInvestigationData(
        institutionPub,
        userPrivKey,
        this.providerData.ax,
        this.leafHash
      ),
    };
  }

  /**
   * @description Calculate dApp specific human ID from zkKYC and dApp address.
   * 
   * @param dAppAddress Address of the dApp.
   * @returns Human ID as string.
   */
  public getHumanID(dAppAddress: string): string {
    return this.poseidon.F.toObject(
      this.poseidon(
        // fill needed fields from zkKYC with dAppAddress added at the correct place
        humanIDFieldOrder.map((field) => field == "dAppAddress" ? dAppAddress : this.content[field]),
        undefined,
        1
      )
    ).toString();
  }

  public getHumanIDProofInput(
    dAppAddress: string,
    passportID: string
  ): HumanIDProofInput {
    return {
      dAppAddress: dAppAddress,
      passportID: passportID,
      humanID: this.getHumanID(dAppAddress),
    };
  }
}
