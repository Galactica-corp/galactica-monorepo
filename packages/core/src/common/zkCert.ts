/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import { z } from 'zod';

import { merkleProofSchema } from './merkleProof';

export const zkCertStandards = ['gip69'] as const;
export type ZkCertStandard = typeof zkCertStandards[number];

export const providerDataSchema = z.object({
  // public eddsa key of provider
  ax: z.string(),
  ay: z.string(),
  // signature of the zkCert content hash by the provider
  s: z.string(),
  r8x: z.string(),
  r8y: z.string(),
});

export const zkCertSchema = z.object({
  holderCommitment: z.string(),
  leafHash: z.string(),
  zkCertStandard: z.enum(zkCertStandards),
  randomSalt: z.number(),
  // TODO: Is this kyc-content?
  // Should we type it?
  content: z.any(),
  providerData: providerDataSchema,
  contentHash: z.string(),
  did: z.string().startsWith('did:'),
});

export const registeredZkCertSchema = zkCertSchema.extend({
  // Proof showing that the zkCert is part of the Merkle tree
  // Updating it helps to prevent tracking through finding uses of the same merkle root
  merkleProof: merkleProofSchema,
});

// / Data required for ZK fraud proofs
export type ProviderData = z.infer<typeof providerDataSchema>;

// / Data contained in a ZK certificate
export type ZkCertData = z.infer<typeof zkCertSchema>;

export type RegisteredZkCert = z.infer<typeof registeredZkCertSchema>;

// / Data required for ZK ownership proofs
export type OwnershipProofInput = {
  holderCommitment: string;
} & ProviderData;

// / Data required for ZK authorization proofs
export type AuthorizationProofInput = {
  userAddress: string;
} & ProviderData;

// / Data required for ZK fraud proofs
export type FraudInvestigationDataEncryptionProofInput = {
  userPrivKey: string;
  userPubKey: string[];

  investigationInstitutionPubkey: string[];
  encryptedData: string[];
};

// / Data required for a ZK proof of someone's DApp specific HumanID
export type HumanIDProofInput = {
  passportID: string;
  dAppAddress: string;
  humanID: string;
};

export type ZkCertProof = {
  proof: {
    pi_a: [string, string];
    pi_b: [[string, string], [string, string]];
    pi_c: [string, string];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
};

export type SharedZkCert = {
  providerPubKey: {
    ax: string;
    ay: string;
  };
  expirationDate: number;
  verificationLevel: string;
};

/**
 * Ordered list of fields common to all zkCerts.
 */
export const zkCertCommonFields = [
  'contentHash',
  'providerAx',
  'providerAy',
  'providerS',
  'providerR8x',
  'providerR8y',
  'holderCommitment',
  'randomSalt',
];

/**
 * Ordered list of fields contained specifically in the zkKYC.
 * It does not include fields that are common to all zkCerts.
 */
export const zkKYCContentFields = [
  'surname',
  'forename',
  'middlename',
  'yearOfBirth',
  'monthOfBirth',
  'dayOfBirth',
  'verificationLevel',
  'expirationDate',
  'streetAndNumber',
  'postcode',
  'town',
  'region',
  'country',
  'citizenship',
  'passportID',
];

/**
 * Ordered list of fields determining the DApp specific Human ID.
 */
export const humanIDFieldOrder = [
  'surname',
  'forename',
  'middlename',
  'yearOfBirth',
  'monthOfBirth',
  'dayOfBirth',
  'passportID',
  'dAppAddress',
];
