// SPDX-License-Identifier: BUSL-1.1
import { ZkCertRegistered } from '@galactica-net/snap-api';
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
