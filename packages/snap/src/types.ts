import { MetaMaskInpageProvider } from '@metamask/providers';
import { SnapsGlobalObject } from '@metamask/snaps-types';
import { JsonRpcRequest } from '@metamask/types';
import { ProviderData, MerkleProof, ZkCertStandard } from 'zkkyc';

import { ZkKYCContent } from './zkCertTypes';

export type RpcArgs = {
  origin: string;
  request: JsonRpcRequest<unknown[] | { [key: string]: unknown }>;
};

export type SnapRpcProcessor = (
  args: RpcArgs,
  snap: SnapsGlobalObject,
  ethereum: MetaMaskInpageProvider,
) => Promise<unknown>;

// requirements on the type of zkCert that is used as proof input
export type ZkCertRequirements = {
  // identifier of the zkCert standard (e.g. gip69 for zkKYC)
  zkCertStandard: string;
};

/**
 * Parameter for requests to generate a zkKYC proof.
 */
export type GenZkKycRequestParams<ProofInputType> = {
  // proof inputs that are passed in addition to the zkCert data
  // Which of these become public proof inputs is defined in the ZK circuit, which is compiled into the WASM.
  input: ProofInputType;
  requirements: ZkCertRequirements;

  // Prover code in web assembly that will be used to generate the proof in the Snap.
  wasm: any;
  // Corresponding parameters from the zkey file (SNARK trusted setup ceremony).
  zkeyHeader: any;
  zkeySections: any[];
};

/**
 * Parameter for holder setup.
 */
export type SetupHolderParams = {
  holderAddr: string;
};

/**
 * Parameter for zkCert import.
 */
export type ImportRequestParams = {
  zkCert: ZkCert;
};

/**
 * Data defining a zk circuit prover
 */
export type ProverData = {
  // Prover code in web assembly that will be used to generate the proof in the Snap.
  wasm: any;
  // Corresponding parameters from the zkey file (SNARK trusted setup ceremony).
  zkeyHeader: any;
  zkeySections: any[];
};

/**
 * Parameter for zkCert export.
 */
export type ExportRequestParams = {
  zkCertStandard: string;
};

/**
 * zkCert proof to be returned to the website.
 */
export type ZkCertProof = {
  proof: any;
  publicSignals: string[];
};

// TODO: remove this type and use the one from the zkKYC package
export type ZkCert = {
  holderCommitment: string;
  providerSignature: string;
  leafHash: string;
  did: string;
  contentHash: string;
  randomSalt: number;
  providerData: ProviderData;

  // identifier of the zkCert standard (e.g. zkKYC, zkDiploma, zkGymMembership, ...)
  zkCertStandard: ZkCertStandard;
  // holding the data specific to the type of zkCert (e.g. zkKYCContent)
  content: ZkKYCContent | any;

  // TODO: think of mechanism to preserve privacy by not using the same merkle proof every time
  merkleProof: MerkleProof;
};

export type HolderData = {
  address: string;
  holderCommitment: string;
  eddsaKey: string;
};

export type StorageState = {
  holders: HolderData[];
  zkCerts: ZkCert[];
};

export type ZkKYCAgeProofInput = {
  // time to check against the expiration date
  currentTime: number;
  // institution public key for eventual fraud investigations
  investigationInstitutionPubKey: [string, string];
  // dApp address to prove the ZKP to
  dAppAddress: string;

  // age proof specific inputs
  currentYear: string;
  currentMonth: string;
  currentDay: string;
  ageThreshold: string;
};
