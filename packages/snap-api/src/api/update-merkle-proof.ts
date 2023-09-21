import { RpcMethods } from './rpcEnums';
import { MerkleProof } from './types';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Parameter for updating the Merkle proof of one or more zkCerts.
 */
export type MerkleProofUpdateRequestParams = {
  proofs: MerkleProof[];
};

/**
 * UpdateMerkleProof allows you to update a list of zkCerts with new Merkle proofs.
 *
 * @param merkleUpdate - Merkle proofs to update to.
 * @returns Success message.
 * @throws RPCError on failure.
 */
export const updateMerkleProof = async (
  merkleUpdate: MerkleProofUpdateRequestParams,
) => {
  const response = await invokeSnap({
    method: RpcMethods.UpdateMerkleProof,
    params: merkleUpdate,
  });
  return response;
};
