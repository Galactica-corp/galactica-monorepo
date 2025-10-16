// SPDX-License-Identifier: BUSL-1.1
import type { EddsaPrivateKey } from '@galactica-net/galactica-types';
import type { ZkCertRegistered } from '@galactica-net/snap-api';
import type {
  Json,
  JsonRpcParams,
  SnapsEthereumProvider,
  SnapsProvider,
} from '@metamask/snaps-sdk';
import type { NodeType } from '@metamask/snaps-ui';
import type { JsonRpcRequest } from '@metamask/types';
import type { AnySchema } from 'ajv/dist/2020';

export type RpcArgs = {
  origin: string;
  request: JsonRpcRequest<JsonRpcParams>;
};

export type SnapRpcProcessor = (
  args: RpcArgs,
  snap: SnapsProvider,
  ethereum: SnapsEthereumProvider,
) => Promise<Json>;

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
  zkCert: ZkCertRegistered<Record<string, Json>>;
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
