import { invokeSnap } from '../utils/invoke-snap';
import { GenericError } from './error';
import { RpcMethods } from './rpcEnums';

export interface HolderCommitmentData {
  holderCommitment: string;
  // TODO: add pubkey for encryption
}

export type GetHolderCommitmentResponse = HolderCommitmentData | GenericError;

/**
 * GetHolderCommitment queries the commitment identifying the holder from the snap.
 * The returned data is required by guardians to create ZK certificates.
 *
 * @returns HolderCommitmentData or Error.
 */
export const getHolderCommitment = async () => {
  const response: GetHolderCommitmentResponse = await invokeSnap({
    method: RpcMethods.GetHolderCommitment,
  });

  return response;
};
