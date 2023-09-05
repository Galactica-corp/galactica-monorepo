import { SnapsGlobalObject } from '@metamask/rpc-methods';
import { selectZkCert } from '../zkCertSelector';
import { getState, saveState } from '../stateManagement';
import { heading, panel, text } from '@metamask/snaps-ui';
import {
  DeleteZkCertError,
  DeleteZkCertParams,
  deleteZkCertParamsSchema,
} from '@galactica-net/core';
import { RpcArgs } from '../types';

export const deleteZkCert = async (
  snap: SnapsGlobalObject,
  { request, origin }: RpcArgs,
) => {
  const requestParams = request.params;
  if (!requestParams) {
    throw new Error('Parameters are required');
  }

  let params: DeleteZkCertParams;
  try {
    params = deleteZkCertParamsSchema.parse(requestParams);
  } catch (error) {
    throw error;
  }

  const state = await getState(snap);

  const expirationDate = params.expirationDate
    ? new Date(params.expirationDate).getTime()
    : undefined;

  // get existing zkCerts that the fit to the delete filter
  const zkCertToDelete = await selectZkCert(
    snap,
    state.zkCerts,
    params.zkCertStandard,
    expirationDate,
    params.providerAx,
  );

  const confirm = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        heading('Delete zkCert?'),
        text(`Do you want to delete the following zkCert from MetaMask?`),
        text(`${zkCertToDelete.did}`),
      ]),
    },
  });

  if (!confirm) {
    return new DeleteZkCertError({
      name: 'RejectedConfirm',
      message: 'User rejected confirmation.',
      cause: request,
    });
  }

  state.zkCerts = state.zkCerts.filter(
    (zkCert) => zkCert.leafHash !== zkCertToDelete.leafHash,
  );

  await saveState(snap, state);

  return true;
};
