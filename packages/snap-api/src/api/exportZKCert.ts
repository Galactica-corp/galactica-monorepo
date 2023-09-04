import { invokeSnap } from '../utils/invoke-snap';
import { GenericError } from './error';
import { RpcMethods } from './rpcEnums';
import { ZkCertStandard, ZkCertData } from './types';

/**
 * Parameter for requests to export a ZK certificate from the snap.
 */
export interface ExportZkCertParams {
  requirements: {
    // For the standard of the zkCertificate that should be used for the proof.
    zkCertStandard: ZkCertStandard;
  };
};

export type ExportZkCertResponse = ZkCertData | GenericError;

/**
 * Exports a zkCertificate stored in the snap.
 *
 * @param params - Parameters with requirements to filter what kind of zkCert to export.
 * @returns ZkCert data or error.
 */
export const exportZkCert = async (
  params: ExportZkCertParams,
) => {
  const response: ExportZkCertResponse = await invokeSnap({
    method: RpcMethods.ExportZkCert,
    params,
  });

  return response;
};
