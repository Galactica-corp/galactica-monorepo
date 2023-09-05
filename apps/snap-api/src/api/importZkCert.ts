import {
  ImportZkCertError,
  ImportZkCertParams,
  ImportZkCertResponse,
} from '@galactica-net/core';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Imports a zkCertificate from a file into the Snap.
 *
 * @param zkCert - The zkCert to be imported.
 * @example
 * const response = await importZkCert({ zkCert: JSON.parse(fileContent) })
 */
export const importZkCert = async (params: ImportZkCertParams) => {
  const response: ImportZkCertResponse | ImportZkCertError = await invokeSnap({
    method: 'importZkCert',
    params,
  });

  return response;
};

export const isImportZkCertError = (
  error: unknown,
): error is ImportZkCertError => error instanceof ImportZkCertError;
