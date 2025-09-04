import { RpcMethods } from './rpcEnums';
import type { ZkCertSelectionParams, ZkCertStandard } from './types';
import { sdkConfig } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

export type ZkCertListItem = {
  standard: ZkCertStandard;
  expirationDate: number;
};

export type ZkCertMetadataList = ZkCertListItem[];

/**
 * Requests overview of zkCertificates held in the Snap for management.
 *
 * @param params - Parameters with requirements to filter what kind of zkCert to list.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns List of ZkCertificates available in the Snap.
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
