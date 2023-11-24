import { RpcMethods } from './rpcEnums';
import { ZkCertStandard } from './types';
import { config } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

export type ZkCertStorageHashes = Partial<Record<ZkCertStandard, string>>;

/**
 * GetZkStorageHashes helps you detect changes in the zkCert storage of the snap.
 * It returns a hash of all zkCerts for each standard, so you can compare it with the previous hash to see if anything changed.
 *
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns Hashes of all zkCerts for each standard.
 * @throws RPCError on failure.
 */
export const getZkStorageHashes = async (
  snapOrigin: string = config.defaultSnapOrigin,
) => {
  const response: ZkCertStorageHashes = await invokeSnap(
    {
      method: RpcMethods.GetZkCertStorageHashes,
    },
    snapOrigin,
  );
  return response;
};
