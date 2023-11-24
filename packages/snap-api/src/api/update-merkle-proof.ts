import { RpcMethods } from './rpcEnums';
import type { MerkleProof } from './types';
import { sdkConfig } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Parameter for updating the Merkle proof of one or more zkCerts.
 */
export type MerkleProofUpdateRequestParams = {
  updates: {
    registryAddr: string;
    proof: MerkleProof;
  }[];
};

/**
 * UpdateMerkleProof allows you to update a list of zkCerts with new Merkle proofs.
 * @param merkleUpdate - Merkle proofs to update to.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns Success message.
 * @throws RPCError on failure.
 */
export const updateMerkleProof = async (
  merkleUpdate: MerkleProofUpdateRequestParams,
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  const response = await invokeSnap(
    {
      method: RpcMethods.UpdateMerkleProof,
      params: merkleUpdate,
    },
    snapOrigin,
  );
  return response;
};
