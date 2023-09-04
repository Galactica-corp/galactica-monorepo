import { invokeSnap } from '../utils/invoke-snap';
import { GenericError } from './error';
import { RpcMethods } from './rpcEnums';
import { ZkCertSelectionParams } from './types';


export type DeleteZkCertResponse = string | GenericError;

/**
 * Exports a zkCertificate stored in the snap.
 *
 * @param params - Parameters with requirements to filter what kind of zkCert to export.
 * @returns ZkCert data or error.
 */
export const deleteZkCert = async (
  params: ZkCertSelectionParams,
) => {
  const response: DeleteZkCertResponse = await invokeSnap({
    method: RpcMethods.ExportZkCert,
    params,
  });

  return response;
};
