import { invokeSnap } from "../utils/invoke-snap";
import { ZkCertStandard } from "./types";
import { RpcMethods } from "../api/rpcEnums";

/**
 * Detect changes in the zkCert storage of the snap
 */
export const getZkStorageHashes = async () => {
  const response: Record<ZkCertStandard, string | undefined> = await invokeSnap(
    {
      method: RpcMethods.GetZkCertStorageHashes,
    }
  );

  return response;
};
