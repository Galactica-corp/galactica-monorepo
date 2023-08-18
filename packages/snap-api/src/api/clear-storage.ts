import { invokeSnap } from "../utils/invoke-snap";

type Response = "zkCert storage cleared";

/**
 * Request for removing data stored in the Snap (holders and zkCertificates).
 *
 *
 * @example
 * const response = await clearStorage()
 */
export const clearStorage = async () => {
  const response: Response = await invokeSnap({ method: "clearStorage" });
  return response;
};
