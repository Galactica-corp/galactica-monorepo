import { invokeSnap } from "../utils/invoke-snap";
import { ZkCertStandard } from "./types";

/**
 * Detect changes in the zkCert storage of the snap
 */
export const getZkStorageHashes = async () => {
  const response: Record<ZkCertStandard, string | undefined> = await invokeSnap(
    {
      method: "getZkCertStorageHashes",
    }
  );

  return response;
};
