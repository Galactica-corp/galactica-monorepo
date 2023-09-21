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

/**
 * Union of any ZkCertInputType.
 */
export type ZkCertInputType =
  | ZkKYCProofInput
  | ZkKYCAgeProofInput
  | Record<string, any>;
