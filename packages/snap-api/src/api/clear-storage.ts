import { invokeSnap } from "../utils/invoke-snap";
import { RpcMethods } from "../api/rpcEnums";

/**
 * Request for removing data stored in the Snap (holders and zkCertificates).
 *
 *
 * @example
 * const response = await clearStorage()
 */
export const clearStorage = async () => {
  const response: Response = await invokeSnap({ method: RpcMethods.ClearStorage });
  return response;
};
