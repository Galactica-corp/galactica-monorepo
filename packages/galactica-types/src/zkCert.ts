import type { MerkleProof } from './merkleProof';
import type { ZkCertStandard, ZkKYCContent } from './zkCertStandard';

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

// / Data required for ZK fraud proofs
export type ProviderData = {
  // public eddsa key of provider
  ax: string;
  ay: string;
  // signature of the zkCert content hash by the provider
  s: string;
  r8x: string;
  r8y: string;
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
export type ZkCertData = {
  holderCommitment: string;
  // identifier of the zkCert standard (e.g. zkKYC, zkDiploma, zkGymMembership, ...)
  zkCertStandard: ZkCertStandard;
  randomSalt: string;
  expirationDate: number;
  content: ZkKYCContent | Record<string, any>;
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

export type ZkCertRegistered = ZkCertData & {
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
