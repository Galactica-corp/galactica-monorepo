// SPDX-License-Identifier: BUSL-1.1
import type {
  AnyZkCertContent,
  EddsaPrivateKey,
} from '@galactica-net/galactica-types';
import type { ZkCertRegistered } from '@galactica-net/snap-api';
import type { MetaMaskInpageProvider } from '@metamask/providers';
import type { SnapsGlobalObject } from '@metamask/snaps-types';
import type { NodeType } from '@metamask/snaps-ui';
import type { JsonRpcRequest } from '@metamask/types';
import type { AnySchema } from 'ajv/dist/2020';

export type RpcArgs = {
  origin: string;
  request: JsonRpcRequest<unknown[] | { [key: string]: unknown }>;
};

export type SnapRpcProcessor = (
  args: RpcArgs,
  snap: SnapsGlobalObject,
  ethereum: MetaMaskInpageProvider,
) => Promise<unknown>;

export type HolderData = {
  // address: string; Not needed as long as we do not support HW wallets
  holderCommitment: string;
  // keys for encrypting zkCert data between the holder and the guardian
  encryptionPubKey: string;
  encryptionPrivKey: string;
  eddsaKey: EddsaPrivateKey;
};

/**
 * Everything the snap needs to store about a zkCert.
 */
export type ZkCertStorage = {
  zkCert: ZkCertRegistered<AnyZkCertContent>;
  schema: AnySchema;
};

export type StorageState = {
  holders: HolderData[];
  zkCerts: ZkCertStorage[];
  merkleServiceURL?: string;
  storageLayoutVersion: number;
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
