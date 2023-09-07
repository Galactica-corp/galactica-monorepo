import { invokeSnap } from '../utils/invoke-snap';
import { RpcMethods } from './rpcEnums';
import { ZkCertSelectionParams } from './types';


export type DeleteZkCertResponse = string;

/**
 * Exports a zkCertificate stored in the snap.
 *
 * @param params - Parameters with requirements to filter what kind of zkCert to export.
 * @returns ZkCert data or error.
 * @throws RPCError on failure.
 */
export const deleteZkCert = async (
  params: ZkCertSelectionParams,
) => {
  const response: DeleteZkCertResponse = await invokeSnap({
    method: RpcMethods.DeleteZkCert,
    params,
  });

  return response;
};
