import { invokeSnap } from '../utils/invoke-snap';
import { RpcMethods } from './rpcEnums';
import { ZkCertStandard } from './types';

export type ListZkCertsError = unknown;

export type ListZkCertsItem = {
  providerPubKey: {
    ax: string;
    ay: string;
  };
  expirationDate: number;
  verificationLevel: string;
};

export type ListZkCertsResponse = Record<ZkCertStandard, ListZkCertsItem[]>;

/**
 * Requests overview of zkCertificates held in the Snap for management.
 */
export const listZkCerts = async () => {
  const response: ListZkCertsResponse = await invokeSnap({
    method: RpcMethods.ListZkCerts,
  });
  return response;
};
