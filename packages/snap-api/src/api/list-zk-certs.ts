import { invokeSnap } from '../utils/invoke-snap';
import { RpcMethods } from './rpcEnums';
import { ZkCertStandard } from './types';

export interface ZkCertListItem {
  providerPubKey: {
    ax: string;
    ay: string;
  };
  expirationDate: number;
  verificationLevel: string;
};

export type ZkCertMetadataList = Record<ZkCertStandard, ZkCertListItem[]>;

/**
 * Requests overview of zkCertificates held in the Snap for management.
 */
export const listZkCerts = async () => {
  const response: ZkCertMetadataList = await invokeSnap({
    method: RpcMethods.ListZkCerts,
  });
  return response;
};
