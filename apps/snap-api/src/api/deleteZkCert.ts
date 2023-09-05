import {
  DeleteZkCertError,
  DeleteZkCertParams,
  DeleteZkCertResponse,
} from '@galactica-net/core';
import { invokeSnap } from '../utils/invoke-snap';

export const deleteZkCert = async (params: DeleteZkCertParams) => {
  const response: DeleteZkCertResponse = await invokeSnap({
    method: 'deleteZkCert',
    params,
  });

  return response;
};

export const isDeleteZkCertError = (
  error: unknown,
): error is DeleteZkCertError => error instanceof DeleteZkCertError;
