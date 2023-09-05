import { ClearStorageError, ClearStorageResponse } from '@galactica-net/core';
import { SnapsGlobalObject } from '@metamask/rpc-methods';
import { MethodReturnType } from '@metamask/rpc-methods/dist/request';
import { heading, panel, text } from '@metamask/snaps-ui';

import { saveState } from '../stateManagement';
import { RpcArgs } from '../types';

export const clearStorage = async (
  snap: SnapsGlobalObject,
  { origin, request }: RpcArgs,
) => {
  let confirm: Awaited<MethodReturnType<'snap_dialog'>> = null;
  try {
    confirm = await snap.request({
      method: 'snap_dialog',
      params: {
        type: 'confirmation',
        content: panel([
          heading('Clear zkCert and holder storage?'),
          text(
            `Do you want to delete the zkCertificates stored in Metamask? (requested by ${origin})`,
          ),
        ]),
      },
    });
  } catch (error) {
    // TODO: handle this error
  }

  if (!confirm) {
    return new ClearStorageError({
      name: 'RejectedConfirm',
      message: 'User rejected confirmation.',
      cause: request,
    });
  }

  try {
    await saveState(snap, { holders: [], zkCerts: [] });
  } catch (error) {
    // TODO: handle this error
  }

  const response: ClearStorageResponse = {
    data: true,
  };
  return response;
};
