import { RpcMethods } from './rpcEnums';
import { sdkConfig } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * GetZkCertHashes queries a list of zkCert hashes from the Snap API.
 * These are the merkle leaves needed to regenerate Merkle proofs.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns List of zkCert hashes.
 * @throws RPCError on failure.
 */
export const getZkCertHashes = async (
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  const response = await invokeSnap(
    { method: RpcMethods.GetZkCertHash },
    snapOrigin,
  );
  return response as [string];
};
