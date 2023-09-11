import { RpcMethods } from './rpcEnums';
import { invokeSnap } from '../utils/invoke-snap';

export type HolderCommitmentData = {
  holderCommitment: string;
  encryptionPubKey: string;
};

/**
 * GetHolderCommitment queries the commitment identifying the holder from the snap.
 * The returned data is required by guardians to create ZK certificates.
 *
 * @returns HolderCommitmentData or Error.
 * @throws RPCError on failure.
 */
export const getHolderCommitment = async () => {
  const response: HolderCommitmentData = await invokeSnap({
    method: RpcMethods.GetHolderCommitment,
  });

  return response;
};
