import { GalacticaErrorBase } from "./error";
import { invokeSnap } from "../utils/invoke-snap";
import { ZkCert, ZkCertStandard } from "./types";

type ErrorName = "SomethingWentWrongWithImport" | "SomethingWentWrong2";

export class ImportZkCertError extends GalacticaErrorBase<ErrorName> {}

export type ImportZkCertParams = {
  zkCert: ZkCert;
};

/**
 * Imports a zkCertificate from a file into the Snap.
 *
 * @example
 * const response = await importZkCert({ zkCert: JSON.parse(fileContent) })
 */
export const importZkCert = async (params: ImportZkCertParams) => {
  const response = await invokeSnap({
    method: "importZkCert",
    params: { ...params, listZkCerts: true },
  });
  return response as Record<ZkCertStandard, ZkCert[]>;
};
