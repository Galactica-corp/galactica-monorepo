import { GetZkCertStorageHashesResponse } from '@galactica-net/core';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Detect changes in the zkCert storage of the snap.
 */
export const getZkStorageHashes = async () => {
  const response: GetZkCertStorageHashesResponse = await invokeSnap({
    method: 'getZkCertStorageHashes',
  });

  return response;
};
