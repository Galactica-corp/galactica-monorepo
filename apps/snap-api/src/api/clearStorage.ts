import { ClearStorageResponse, ClearStorageError } from '@galactica-net/core';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Request for removing data stored in the Snap (holders and zkCertificates).
 *
 *
 * @example
 * const response = await clearStorage()
 */
export const clearStorage = async () => {
  const response: ClearStorageResponse = await invokeSnap({
    method: 'clearStorage',
  });
  return response;
};

export const isClearStorageError = (
  error: unknown,
): error is ClearStorageError => error instanceof ClearStorageError;
