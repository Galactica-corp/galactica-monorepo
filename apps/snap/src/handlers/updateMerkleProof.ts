import { SnapsGlobalObject } from '@metamask/rpc-methods';
import { RpcArgs } from '../types';
import { heading, panel, text } from '@metamask/snaps-ui';
import { getState, saveState } from '../stateManagement';
import {
  UpdateMerkleProofError,
  UpdateMerkleProofParams,
  UpdateMerkleProofResponse,
  updateMerkleProofParamsSchema,
} from '@galactica-net/core';

// To preserve privacy by not using the same merkle proof every time, the merkle proof can be updated.
export const updateMerkleProof = async (
  snap: SnapsGlobalObject,
  { request, origin }: RpcArgs,
) => {
  const requestParams = request.params;

  if (!requestParams) {
    throw new Error('Parameters are required');
  }

  let params: UpdateMerkleProofParams;
  try {
    params = updateMerkleProofParamsSchema.parse(requestParams);
  } catch (error) {
    // TODO: handle error
    throw error;
  }

  const confirm = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        heading('Update Merkle proofs?'),
        text(
          `Do you want to update the merkle proofs of your zkCerts as suggested by ${origin}?`,
        ),
      ]),
    },
  });

  if (!confirm) {
    return new UpdateMerkleProofError({
      name: 'RejectedConfirm',
      message: 'User rejected confirmation.',
      cause: request,
    });
  }

  const state = await getState(snap);

  const updatedZkCerts = params.proofs.map((proof) => {
    const zkCert = state.zkCerts.find(
      ({ leafHash }) => leafHash === proof.leaf,
    );

    if (!zkCert) {
      throw new UpdateMerkleProofError({
        name: 'NotFound',
        message: `The zkCert with leaf hash ${proof.leaf} was not found in the wallet. Please import it before updating the Merkle proof.`,
      });
    }

    zkCert.merkleProof = proof;

    return zkCert;
  });

  await saveState(snap, state);

  const response: UpdateMerkleProofResponse = {
    data: true,
  };
  return response;
};
