import { SnapsGlobalObject } from '@metamask/rpc-methods';
import { RpcArgs } from '../types';
import { heading, panel, text } from '@metamask/snaps-ui';
import { getZkCertStorageOverview } from '../zkCertHandler';
import { ListZkCertsError, ListZkCertsResponse } from '@galactica-net/core';
import { getState } from '../stateManagement';

export const listZkCerts = async (
  snap: SnapsGlobalObject,
  { origin, request }: RpcArgs,
) => {
  const confirm = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        heading('Provide the list of your zkCertificates to the application'),
        text(
          `The application "${origin}" requests to get an overview of zkCertificates stored in your MetaMask. This overview does not contain personal information, only metadata (expiration date of the document, issue, and verification level).`,
        ),
      ]),
    },
  });

  if (!confirm) {
    return new ListZkCertsError({
      name: 'RejectedConfirm',
      message: 'User rejected confirmation.',
      cause: request,
    });
  }

  const state = await getState(snap);

  const response: ListZkCertsResponse = {
    data: getZkCertStorageOverview(state.zkCerts),
  };

  return response;
};
