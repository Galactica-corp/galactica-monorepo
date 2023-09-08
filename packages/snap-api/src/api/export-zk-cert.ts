import { RpcMethods } from './rpcEnums';
import { ZkCertSelectionParams, ZkCertData } from './types';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Exports a zkCertificate stored in the snap.
 *
 * @param params - Parameters with requirements to filter what kind of zkCert to export.
 * @returns ZkCert data or error.
 * @throws RPCError on failure.
 */
export const exportZkCert = async (params: ZkCertSelectionParams) => {
  const response: ZkCertData = await invokeSnap({
    method: RpcMethods.ExportZkCert,
    params,
  });

  return response;
};
