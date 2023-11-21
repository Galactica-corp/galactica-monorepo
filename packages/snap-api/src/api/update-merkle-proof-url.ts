import { RpcMethods } from './rpcEnums';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Parameter for updating the URL to get Merkle proofs from.
 */
export type MerkleProofURLUpdateParams = {
  url: string;
};

/**
 * UpdateMerkleProof allows you to update the url to get new merkle proofs from.
 * This is only a fallback until we have a decentralized solution.
 *
 * @param update - New URL to get Merkle proofs from.
 * @returns Success message.
 * @throws RPCError on failure.
 */
export const updateMerkleProofURL = async (
  update: MerkleProofURLUpdateParams,
) => {
  const response = await invokeSnap({
    method: RpcMethods.UpdateMerkleProofURL,
    params: update,
  });
  return response;
};
