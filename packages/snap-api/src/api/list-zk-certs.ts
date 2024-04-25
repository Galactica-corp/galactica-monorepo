import { RpcMethods } from './rpcEnums';
import type { ZkCertStandard, ZkCertSelectionParams } from './types';
import { sdkConfig } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

export type ZkCertListItem = {
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
 * @param params - Parameters with requirements to filter what kind of zkCert to list.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns List of ZKCertificates available in the Snap.
 */
export const listZkCerts = async (
  params: ZkCertSelectionParams,
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  const response: ZkCertMetadataList = await invokeSnap(
    {
      method: RpcMethods.ListZkCerts,
      params,
    },
    snapOrigin,
  );
  return response;
};
