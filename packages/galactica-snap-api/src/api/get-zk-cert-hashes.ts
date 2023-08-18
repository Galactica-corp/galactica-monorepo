import { invokeSnap } from "../utils/invoke-snap";

export const getZkCertHashes = async () => {
  const response = await invokeSnap({ method: "getZkCertHashes" });
  return response as { gip69: string };
};
