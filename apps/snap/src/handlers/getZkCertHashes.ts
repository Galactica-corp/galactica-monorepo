import { SnapsGlobalObject } from '@metamask/rpc-methods';
import { heading, panel, text } from '@metamask/snaps-ui';
import { RpcArgs } from '../types';
import { getState } from '../stateManagement';
import { GetZkCertHashesError } from '@galactica-net/core';

export const getZkCertHashes = async (
  snap: SnapsGlobalObject,
  { origin, request }: RpcArgs,
) => {
  const confirm = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        heading('Provide zkCert hash?'),
        text(
          `Do you want to provide the leaf hashes of your zkCerts to ${origin}?`,
        ),
        text(
          `We suggest doing this only to update Merkle proofs. Only Do this on sites you trust to handle the unique ID of your zkCert confidentially.`,
        ),
      ]),
    },
  });
  if (!confirm) {
    return new GetZkCertHashesError({
      name: 'RejectedConfirm',
      message: 'User rejected confirmation.',
      cause: request,
    });
  }

  const state = await getState(snap);

  return state.zkCerts.map((zkCert) => zkCert.leafHash);
};
