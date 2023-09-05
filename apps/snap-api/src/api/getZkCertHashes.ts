import { invokeSnap } from '../utils/invoke-snap';
import {
  GetZkCertHashesError,
  GetZkCertHashesResponse,
} from '@galactica-net/core';

export const getZkCertHashes = async () => {
  const response: GetZkCertHashesResponse = await invokeSnap({
    method: 'getZkCertHashes',
  });
  return response;
};

export const isGetZkCertHashesError = (
  error: unknown,
): error is GetZkCertHashesError => error instanceof GetZkCertHashesError;
