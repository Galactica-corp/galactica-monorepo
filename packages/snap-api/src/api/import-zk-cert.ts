import { GalacticaErrorBase } from './error';
import { ZkCertMetadataList } from './list-zk-certs';
import { RpcMethods } from './rpcEnums';
import { EncryptedZkCert } from './types';
import { invokeSnap } from '../utils/invoke-snap';

type ImportErrorName = 'HolderMissing' | 'FormatError';

export class ImportZkCertError extends GalacticaErrorBase<ImportErrorName> {}

export type ImportZkCertParams = {
  // The encrypted zkCert to be imported (ZkCertRegistered encrypted with @metamask/eth-sig-util)
  encryptedZkCert: EncryptedZkCert;
  // Should the snap return the list of zkCerts after import (to have 1 less confirmation)
  listZkCerts?: boolean;
};

/**
 * Imports a zkCertificate from a file into the Snap.
 *
 * @param importParams - The zkCert to be imported.
 * @returns List of zkCert metadata or success message.
 * @throws RPCError on failure.
 * @example
 * const response = await importZkCert({ zkCert: JSON.parse(fileContent) })
 */
export const importZkCert = async (importParams: ImportZkCertParams) => {
  const response = await invokeSnap({
    method: RpcMethods.ImportZkCert,
    params: importParams,
  });
  return response as ZkCertMetadataList;
};
