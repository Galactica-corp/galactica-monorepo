import { RpcMethods } from './rpcEnums';
import { ZkCertStandard } from './types';
import { config } from '../config';
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
 *
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 */
export const listZkCerts = async (
  snapOrigin: string = config.defaultSnapOrigin,
) => {
  const response: ZkCertMetadataList = await invokeSnap(
    {
      method: RpcMethods.ListZkCerts,
    },
    snapOrigin,
  );
  return response;
};
