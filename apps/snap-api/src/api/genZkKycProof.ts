import {
  GenZkKycProofParams,
  GenZkKycProofResponse,
  GenZkKycProofError,
} from '@galactica-net/core';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * GenerateZKProof prepares and executes the call to generate a ZKP in the Galactica snap.
 * You can use it to generate various kinds of proofs, depending on the input you pass.
 *
 * @param params - The parameters required to generate a ZKP in the Snap.
 * @returns Request result with the ZK proof or error.
 */
export const genZkKycProof = async (params: GenZkKycProofParams) => {
  const response: GenZkKycProofResponse = await invokeSnap({
    method: 'genZkKycProof',
    params,
  });
  return response;
};

export const isGenZkKycProofError = (
  error: unknown,
): error is GenZkKycProofError => error instanceof GenZkKycProofError;
