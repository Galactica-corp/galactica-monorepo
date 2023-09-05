import {
  ExportZkCertError,
  ExportZkCertParams,
  ExportZkCertResponse,
} from '@galactica-net/core';
import { invokeSnap } from '../utils/invoke-snap';

export const exportZkCert = async (params: ExportZkCertParams) => {
  const response: ExportZkCertResponse = await invokeSnap({
    method: 'exportZkCert',
    params,
  });

  return response;
};

export const isExportZkCertError = (
  error: unknown,
): error is ExportZkCertError => error instanceof ExportZkCertError;
