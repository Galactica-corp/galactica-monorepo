/* eslint-disable @typescript-eslint/naming-convention */
/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import type { FieldElement } from './fieldElement';
import type { MerkleProof } from './merkleProof';
import type { AnyZkCertContent, ZkCertStandard } from './zkCertStandard';

// / Data required for ZK ownership proofs
export type OwnershipProofInput = {
  holderCommitment: string;
  // public key
  ax: string;
  ay: string;
  // signature
  s: string;
  r8x: string;
  r8y: string;
};

// / Data required for ZK authorization proofs
export type AuthorizationProofInput = {
  userAddress: string;
  // public key
  ax: string;
  ay: string;
  // signature
  s: string;
  r8x: string;
  r8y: string;
};

export type ProviderMeta = {
  address?: string;
  cert_background?: string;
  certificate_name?: string;
  certificate_type?: string;
  description?: string;
  icon?: string;
  name?: string;
  url?: string;
};

// / Data required for ZK fraud proofs
export type ProviderData = {
  // public eddsa key of provider
  ax: string;
  ay: string;
  // signature of the zkCert content hash by the provider
  s: string;
  r8x: string;
  r8y: string;
  meta?: ProviderMeta;
};

// / Data required for ZK fraud proofs
export type FraudInvestigationDataEncryptionProofInput = {
  userPrivKey: string;
  userPubKey: string[];

  investigationInstitutionPubkey: string[];
  encryptedData: string[];
};

// / Data required for a ZK proof of someone's DApp specific HumanID, except the KYC data
export type HumanIDProofInput = {
  dAppAddress: string;
};

// / Data contained in a ZK certificate
export type ZkCertData<Content = AnyZkCertContent> = {
  holderCommitment: string;
  // identifier of the zkCert standard (e.g. zkKYC, zkDiploma, zkGymMembership, ...)
  zkCertStandard: ZkCertStandard;
  randomSalt: string;
  expirationDate: number;
  content: Content;
  providerData: ProviderData;
  contentHash: string;
  leafHash: string;
  did: string;
};

/**
 * Data about the registry the zkCert is issued on.
 */
export type ZkCertRegistration = {
  address: string;
  // EVM chain ID the registration smart contract is deployed on
  chainID: number;
  revocable: boolean;
  leafIndex: number;
};

export type ZkCertRegistered<Content = AnyZkCertContent> =
  ZkCertData<Content> & {
    // Data about the registry the zkCert is issued on.
    // Maybe we want to make this a list later if registering a zkCert on multiple registries becomes a thing (e.g. for multiple jurisdictions)
    registration: ZkCertRegistration;

    // Proof showing that the zkCert is part of the Merkle tree
    // Updating it helps to prevent tracking through finding uses of the same merkle root
    merkleProof: MerkleProof;
  };

// Encryption used for zkCerts when being exported or passed from guardian to user
export const ENCRYPTION_VERSION = 'x25519-xsalsa20-poly1305';

export type EncryptedZkCert = {
  // holder commitment to associate the zkCert with the holder who can decrypt it
  holderCommitment: string;
} & EthEncryptedData;

/**
 * Encrypted data type consistent with the EthEncryptedData type from eth-sig-util.
 * We use it to encrypt zkCerts.
 */
export declare type EthEncryptedData = {
  version: string;
  nonce: string;
  ephemPublicKey: string;
  ciphertext: string;
};

export type ProofInput = Record<string, FieldElement | FieldElement[]>;
