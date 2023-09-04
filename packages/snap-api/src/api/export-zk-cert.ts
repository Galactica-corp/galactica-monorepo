import { invokeSnap } from '../utils/invoke-snap';
import { GenericError } from './error';
import { RpcMethods } from './rpcEnums';
import { ZkCertSelectionParams, ZkCertData } from './types';

export type ExportZkCertResponse = ZkCertData | GenericError;

/**
 * Exports a zkCertificate stored in the snap.
 *
 * @param params - Parameters with requirements to filter what kind of zkCert to export.
 * @returns ZkCert data or error.
 */
export const exportZkCert = async (
  params: ZkCertSelectionParams,
) => {
  const response: ExportZkCertResponse = await invokeSnap({
    method: RpcMethods.ExportZkCert,
    params,
  });

  return response;
};
