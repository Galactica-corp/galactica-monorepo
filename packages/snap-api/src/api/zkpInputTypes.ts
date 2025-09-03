/**
 * Public input needed to generate a zkKYC proof with age limit.
 */
export type ZkKYCAgeProofInput = {
  // time to check against the expiration date
  currentTime: number;
  // institution public key for eventual fraud investigations
  investigationInstitutionPubKey: [string, string][];
  // dApp address to prove the ZKP to
  dAppAddress: string;

  // age proof specific inputs
  currentYear: string;
  currentMonth: string;
  currentDay: string;
  ageThreshold: string;
};

/**
 * Public input needed to generate a zkKYC proof with age limit.
 */
export type ZkKYCAgeCitizenshipProofInput = {
  // time to check against the expiration date
  currentTime: number;
  // institution public key for eventual fraud investigations
  investigationInstitutionPubKey: [string, string][];
  // dApp address to prove the ZKP to
  dAppAddress: string;

  // age proof specific inputs
  currentYear: string;
  currentMonth: string;
  currentDay: string;
  ageThreshold: string;
  countryExclusionList: string[];
};

/**
 * Public input needed to generate a zkKYC proof.
 */
export type ZkKYCProofInput = {
  // time to check against the expiration date
  currentTime: number;
  // institution public key for eventual fraud investigations
  investigationInstitutionPubKey: [string, string][];
  // dApp address to prove the ZKP to
  dAppAddress: string;
};

// Re-export ZkCertInputType from zk-certificates to avoid circular dependency
export type { ZkCertInputType } from '@galactica-net/zk-certificates';

// Keep the specific input types here for backward compatibility
export type SpecificZkCertInputType =
  | ZkKYCProofInput
  | ZkKYCAgeProofInput
  | ZkKYCAgeCitizenshipProofInput
  | Record<string, unknown>;
