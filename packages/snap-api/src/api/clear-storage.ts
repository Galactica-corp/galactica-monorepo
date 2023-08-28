import { invokeSnap } from '../utils/invoke-snap';
import { RpcMethods } from './rpcEnums';

/**
 * Request for removing data stored in the Snap (holders and zkCertificates).
 *
 *
 * @example
 * const response = await clearStorage()
 */
export const clearStorage = async () => {
  const response = await invokeSnap({
    method: RpcMethods.ClearStorage,
  });
  return response;
};
