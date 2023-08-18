// SPDX-License-Identifier: BUSL-1.1
import { ZkCert } from '@galactica-net/snap-api';
import {
  MerkleProof,
} from '@galactica-net/zkkyc';
import { SnapsGlobalObject } from '@metamask/snaps-types';
import { NodeType } from '@metamask/snaps-ui';
import { JsonRpcRequest } from '@metamask/types';

export type RpcArgs = {
  origin: string;
  request: JsonRpcRequest<unknown[] | { [key: string]: unknown }>;
};

export type SnapRpcProcessor = (
  args: RpcArgs,
  snap: SnapsGlobalObject,
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

  // address of the user that is going to submit the proof
  userAddress: string;

  // (optional) Description of disclosures made by the proof
  // This is provided by the front-end. The snap can not verify if the prover actually meets those disclosures.
  disclosureDescription?: string;
};

/**
 * Parameters for zkCert deletion.
 * Because the website does not know IDs for zkCerts, it can provide an optional list of filters to simplify selecting the zkCert to be deleted.
 */
export type DeleteRequestParams = {
  zkCertStandard?: string;
  expirationDate?: number;
  providerAx?: string;
};

/**
 * Parameter for updating the Merkle proof of one or more zkCert.
 */
export type MerkleProofUpdateRequestParams = {
  proofs: MerkleProof[];
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

export type HolderData = {
  // address: string; Not needed as long as we do not support HW wallets
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
  investigationInstitutionPubKey: [string, string][];
  // dApp address to prove the ZKP to
  dAppAddress: string;

  // age proof specific inputs
  currentYear: string;
  currentMonth: string;
  currentDay: string;
  ageThreshold: string;
};

export type ZkKYCProofInput = {
  // time to check against the expiration date
  currentTime: number;
  // institution public key for eventual fraud investigations
  investigationInstitutionPubKey: [string, string][];
  // dApp address to prove the ZKP to
  dAppAddress: string;
};

export type PanelContent = (
  | {
    value: string;
    type: NodeType.Heading;
  }
  | {
    value: string;
    type: NodeType.Text;
  }
  | {
    type: NodeType.Divider;
  }
)[];
