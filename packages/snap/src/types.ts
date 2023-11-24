// SPDX-License-Identifier: BUSL-1.1
import type { ZkCertRegistered } from '@galactica-net/snap-api';
import type { BaseProvider } from '@metamask/providers';
import type { SnapsGlobalObject } from '@metamask/snaps-types';
import type { NodeType } from '@metamask/snaps-ui';
import type { JsonRpcRequest } from '@metamask/types';

export type RpcArgs = {
  origin: string;
  request: JsonRpcRequest<unknown[] | { [key: string]: unknown }>;
};

export type SnapRpcProcessor = (
  args: RpcArgs,
  snap: SnapsGlobalObject,
  ethereum: BaseProvider,
) => Promise<unknown>;

export type HolderData = {
  // address: string; Not needed as long as we do not support HW wallets
  holderCommitment: string;
  eddsaKey: string;
  // keys for encrypting zkCert data between the holder and the guardian
  encryptionPubKey: string;
  encryptionPrivKey: string;
};

export type StorageState = {
  holders: HolderData[];
  zkCerts: ZkCertRegistered[];
  merkleServiceURL?: string;
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
