import { invokeSnap } from '../utils/invoke-snap';
import { GalacticaErrorBase, GenericError } from './error';
import { RpcMethods } from './rpcEnums';
import { ZkCertRegistered, ZkCertStandard } from './types';

type ImportErrorName = 'HolderMissing';

export class ImportZkCertError extends GalacticaErrorBase<ImportErrorName> {}

export type ImportZkCertParams = {
  // The zkCert to be imported
  zkCert: ZkCertRegistered;
  // Should the snap return the list of zkCerts after import (to have 1 less confirmation)
  listZkCerts?: boolean;
};

/**
 * Imports a zkCertificate from a file into the Snap.
 *
 * @param zkCert - The zkCert to be imported.
 * @example
 * const response = await importZkCert({ zkCert: JSON.parse(fileContent) })
 */
export const importZkCert = async (zkCert: ImportZkCertParams) => {
  const response = await invokeSnap({
    method: RpcMethods.ImportZkCert,
    params: { zkCert, listZkCerts: true },
  });
  return response as
    | Record<ZkCertStandard, ZkCertRegistered[]>
    | ImportZkCertError
    | GenericError;
};
