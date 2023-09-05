import { invokeSnap } from '../utils/invoke-snap';
import { RpcMethods } from './rpcEnums';

export interface HolderCommitmentData {
  holderCommitment: string;
  // TODO: add pubkey for encryption
}

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
