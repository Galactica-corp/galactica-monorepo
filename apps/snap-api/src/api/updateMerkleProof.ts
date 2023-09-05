import {
  UpdateMerkleProofError,
  UpdateMerkleProofParams,
  UpdateMerkleProofResponse,
} from '@galactica-net/core';
import { invokeSnap } from '../utils/invoke-snap';

export const updateMerkleProof = async (params: UpdateMerkleProofParams) => {
  const response: UpdateMerkleProofResponse = await invokeSnap({
    method: 'updateMerkleProof',
    params,
  });

  return response;
};

export const isUpdateMerkleProofError = (
  error: unknown,
): error is UpdateMerkleProofError => error instanceof UpdateMerkleProofError;
