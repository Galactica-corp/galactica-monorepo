import { SnapsGlobalObject } from '@metamask/rpc-methods';
import { getState } from '../stateManagement';
import { RpcArgs } from '../types';
import {
  GetHolderCommitmentError,
  GetHolderCommitmentResponse,
} from '@galactica-net/core';
import { heading, panel, text } from '@metamask/snaps-ui';

export const getHolderCommitment = async (
  snap: SnapsGlobalObject,
  { request, origin }: RpcArgs,
) => {
  const state = await getState(snap);

  if (state.holders.length === 0) {
    throw new GetHolderCommitmentError({
      name: 'MissingHolder',
      message: 'No holders imported. Please import a holding address first.',
    });
  }

  // Assuming that we have a single holder. Might change when this is implemented: https://github.com/MetaMask/snaps/discussions/1364#discussioncomment-6111359
  const holder = state.holders[0];

  const confirm = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        heading('Provide holder commitment?'),
        text(`Do you want to provide your holder commitment to ${origin}?`),
      ]),
    },
  });
  if (!confirm) {
    return new GetHolderCommitmentError({
      name: 'RejectedConfirm',
      message: 'User rejected confirmation.',
      cause: request,
    });
  }

  const response: GetHolderCommitmentResponse = {
    data: holder.holderCommitment,
  };
  return holder.holderCommitment;
};
