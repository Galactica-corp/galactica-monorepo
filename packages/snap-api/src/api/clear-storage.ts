import { RpcMethods } from './rpcEnums';
import { config } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Request for removing data stored in the Snap (holders and zkCertificates).
 *
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @throws RPCError on failure.
 * @example
 * const response = await clearStorage()
 */
export const clearStorage = async (
  snapOrigin: string = config.defaultSnapOrigin,
) => {
  const response = await invokeSnap(
    { method: RpcMethods.ClearStorage },
    snapOrigin,
  );
  return response;
};
