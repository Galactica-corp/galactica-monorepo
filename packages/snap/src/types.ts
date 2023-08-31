// SPDX-License-Identifier: BUSL-1.1
import { ZkCertRegistered } from '@galactica-net/snap-api';
import { MerkleProof } from '@galactica-net/zkkyc';
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
  zkCerts: ZkCertRegistered[];
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
