import { GalacticaErrorBase } from "./error";
import { invokeSnap } from "../utils/invoke-snap";
import { ZkCert, ZkCertStandard } from "./types";
import { RpcMethods } from "../api/rpcEnums";

type ErrorName = "SomethingWentWrongWithImport" | "SomethingWentWrong2";

export class ImportZkCertError extends GalacticaErrorBase<ErrorName> { }

export type ImportZkCertParams = {
  // The zkCert to be imported
  zkCert: ZkCert;
  // Should the snap return the list of zkCerts after import (to have 1 less confirmation)
  listZkCerts?: boolean;
};

/**
 * Imports a zkCertificate from a file into the Snap.
 *
 * @example
 * const response = await importZkCert({ zkCert: JSON.parse(fileContent) })
 */
export const importZkCert = async (zkCert: ImportZkCertParams) => {
  const response = await invokeSnap({
    method: RpcMethods.ImportZkCert,
    params: { zkCert: zkCert, listZkCerts: true },
  });
  return response as Record<ZkCertStandard, ZkCert[]>;
};
