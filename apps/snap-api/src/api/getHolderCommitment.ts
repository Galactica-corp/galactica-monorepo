import {
  GetHolderCommitmentError,
  GetHolderCommitmentResponse,
} from '@galactica-net/core';
import { invokeSnap } from '../utils/invoke-snap';

export const getHolderCommitment = async () => {
  const response: GetHolderCommitmentResponse = await invokeSnap({
    method: 'getHolderCommitment',
  });

  return response;
};

export const isGetHolderCommitmentError = (
  error: unknown,
): error is GetHolderCommitmentError =>
  error instanceof GetHolderCommitmentError;
