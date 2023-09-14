import { MerkleProof } from './merkleProof';
import { ZkCertStandard, ZkKYCContent } from './zkCertStandard';

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

// / Data required for a ZK proof of someone's DApp specific HumanID
export type HumanIDProofInput = {
  passportID: string;
  dAppAddress: string;
  humanID: string;
};

// / Data contained in a ZK certificate
export type ZkCertData = {
  holderCommitment: string;
  // identifier of the zkCert standard (e.g. zkKYC, zkDiploma, zkGymMembership, ...)
  zkCertStandard: ZkCertStandard;
  randomSalt: number;
  content: ZkKYCContent | Record<string, any>;
  providerData: ProviderData;
  contentHash: string;
  leafHash: string;
  did: string;
};

export type ZkCertRegistered = {
  // Proof showing that the zkCert is part of the Merkle tree
  // Updating it helps to prevent tracking through finding uses of the same merkle root
  merkleProof: MerkleProof;
} & ZkCertData;
