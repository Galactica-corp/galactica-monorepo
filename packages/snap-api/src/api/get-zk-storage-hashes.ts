import { invokeSnap } from '../utils/invoke-snap';
import { RpcMethods } from './rpcEnums';
import { ZkCertStandard } from './types';

export type ZkCertStorageHashes = Partial<Record<ZkCertStandard, string>>;

/**
 * GetZkStorageHashes helps you detect changes in the zkCert storage of the snap.
 * It returns a hash of all zkCerts for each standard, so you can compare it with the previous hash to see if anything changed.
 * @returns Hashes of all zkCerts for each standard.
 * @throws RPCError on failure.
 */
export const getZkStorageHashes = async () => {
  const response: ZkCertStorageHashes = await invokeSnap(
    {
      method: RpcMethods.GetZkCertStorageHashes,
    },
  );
  return response;
};
