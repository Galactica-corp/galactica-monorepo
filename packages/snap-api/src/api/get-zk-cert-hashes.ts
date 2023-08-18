import { invokeSnap } from "../utils/invoke-snap";
import { RpcMethods } from "../api/rpcEnums";

export const getZkCertHash = async () => {
  const response = await invokeSnap({ method: RpcMethods.GetZkCertHash });
  return response as { gip69: string };
};
