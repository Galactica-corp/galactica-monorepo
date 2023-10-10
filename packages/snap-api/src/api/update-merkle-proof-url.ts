import { RpcMethods } from './rpcEnums';
import { sdkConfig } from '../config';
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
 * @param update - Merkle proofs to update to.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns Success message.
 * @throws RPCError on failure.
 */
export const updateMerkleProofURL = async (
  update: MerkleProofURLUpdateParams,
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  const response = await invokeSnap(
    {
      method: RpcMethods.UpdateMerkleProofURL,
      params: update,
    },
    snapOrigin,
  );
  return response;
};
