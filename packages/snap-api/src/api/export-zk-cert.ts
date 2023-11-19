import { RpcMethods } from './rpcEnums';
import { EncryptedZkCert, ZkCertSelectionParams } from './types';
import { sdkConfig } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Exports a zkCertificate stored in the snap.
 *
 * @param params - Parameters with requirements to filter what kind of zkCert to export.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns Encrypted ZkCert data.
 * @throws RPCError on failure.
 */
export const exportZkCert = async (
  params: ZkCertSelectionParams,
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  const response: EncryptedZkCert = await invokeSnap(
    {
      method: RpcMethods.ExportZkCert,
      params,
    },
    snapOrigin,
  );

  return response;
};
