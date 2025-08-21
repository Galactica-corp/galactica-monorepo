import { GalacticaErrorBase } from './error';
import type { ZkCertMetadataList } from './list-zk-certs';
import { RpcMethods } from './rpcEnums';
import type { EncryptedZkCert } from './types';
import { sdkConfig } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

type ImportErrorName = 'HolderMissing' | 'FormatError' | 'MissingSchema';

export class ImportZkCertError extends GalacticaErrorBase<ImportErrorName> {}

export type ImportZkCertParams = {
  // The encrypted zkCert to be imported (ZkCertRegistered encrypted with @metamask/eth-sig-util)
  encryptedZkCert: EncryptedZkCert;
  // Should the snap return the list of zkCerts after import (to have 1 less confirmation)
  listZkCerts?: boolean;
  chainID?: number;

  // Custom JSON schema for the zkCert content, if it is not one of the standard schemas in the galactica-types package
  customSchema?: string;
};

/**
 * Imports a zkCertificate from a file into the Snap.
 *
 * @param importParams - The zkCert to be imported.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns List of zkCert metadata or success message.
 * @throws RPCError on failure.
 * @example
 * const response = await importZkCert({ zkCert: JSON.parse(fileContent) })
 */
export const importZkCert = async (
  importParams: ImportZkCertParams,
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  const response = await invokeSnap(
    {
      method: RpcMethods.ImportZkCert,
      params: importParams,
    },
    snapOrigin,
  );
  return response as ZkCertMetadataList;
};
