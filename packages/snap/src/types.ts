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

// requirements on the zk proof
export type ZkCertRequirements = {
  // identifier of the zkCert standard (e.g. zkKYC, zkDiploma, zkGymMembership, ...)
  zkCertStandard: string;
};

/**
 * Parameter for requests to generate a zkKYC proof.
 */
export type GenZkKycRequestParams = {
  // public inputs that need to be proven
  input: {
    // TODO: fill in real parameters
    currentYear: string;
    currentMonth: string;
    currentDay: string;
    ageThreshold: string;
  };
  requirements: ZkCertRequirements;
  wasm: any;
  zkeyHeader: any;
  zkeySections: any[];
};

/**
 * Parameter for zkCert import.
 */
export type ImportRequestParams = {
  zkCert: ZkCert;
};

/**
 * Parameter for zkCert export.
 */
export type ExportRequestParams = {
  zkCertStandard: string;
};

/**
 * zkCert proof to be reterned to the website.
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
