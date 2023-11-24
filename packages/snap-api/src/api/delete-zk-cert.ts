import { RpcMethods } from './rpcEnums';
import { ZkCertSelectionParams } from './types';
import { config } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

export type DeleteZkCertResponse = string;

/**
 * Exports a zkCertificate stored in the snap.
 *
 * @param params - Parameters with requirements to filter what kind of zkCert to export.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns ZkCert data or error.
 * @throws RPCError on failure.
 */
export const deleteZkCert = async (
  params: ZkCertSelectionParams,
  snapOrigin: string = config.defaultSnapOrigin,
) => {
  const response: DeleteZkCertResponse = await invokeSnap(
    {
      method: RpcMethods.DeleteZkCert,
      params,
    },
    snapOrigin,
  );

  return response;
};
