import { RpcMethods } from './rpcEnums';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Request for removing data stored in the Snap (holders and zkCertificates).
 *
 * @throws RPCError on failure.
 * @example
 * const response = await clearStorage()
 */
export const clearStorage = async () => {
  const response = await invokeSnap({
    method: RpcMethods.ClearStorage,
  });
  return response;
};
