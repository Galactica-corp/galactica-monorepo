import { RpcMethods } from './rpcEnums';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * GetZkCertHashes queries a list of zkCert hashes from the Snap API.
 * These are the merkle leaves needed to regenerate Merkle proofs.
 *
 * @returns List of zkCert hashes.
 * @throws RPCError on failure.
 */
export const getZkCertHashes = async () => {
  const response = await invokeSnap({ method: RpcMethods.GetZkCertHash });
  return response as [string];
};
