import { invokeSnap } from '../utils/invoke-snap';
import { RpcMethods } from './rpcEnums';
import { ZkCertStandard } from './types';

/**
 * Detect changes in the zkCert storage of the snap.
 */
export const getZkStorageHashes = async () => {
  const response: Record<ZkCertStandard, string | undefined> = await invokeSnap(
    {
      method: RpcMethods.GetZkCertStorageHashes,
    },
  );

  return response;
};
