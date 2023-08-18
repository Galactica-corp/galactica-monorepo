import { invokeSnap } from "../utils/invoke-snap";
import { ZkCertStandard } from "./types";

export type ListZkCertsError = unknown;

export type ListZkCertsItem = {
  providerPubKey: {
    Ax: string;
    Ay: string;
  };
  expirationDate: number;
  verificationLevel: string;
};

export type ListZkCertsResponse = Record<ZkCertStandard, ListZkCertsItem[]>;

/**
 * Requests overview of zkCertificates held in the Snap for management
 */
export const listZkCerts = async () => {
  const response: ListZkCertsResponse = await invokeSnap({
    method: "listZkCerts",
  });
  return response;
};
