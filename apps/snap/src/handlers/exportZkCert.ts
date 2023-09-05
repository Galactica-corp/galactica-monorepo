import { SnapsGlobalObject } from '@metamask/rpc-methods';
import { RpcArgs } from '../types';
import {
  ExportZkCertError,
  ExportZkCertParams,
  exportZkCertParamsSchema,
  ExportZkCertResponse,
} from '@galactica-net/core';
import { heading, panel, text } from '@metamask/snaps-ui';
import { selectZkCert } from '../zkCertSelector';
import { getState } from '../stateManagement';

export const exportZkCert = async (
  snap: SnapsGlobalObject,
  { origin, request }: RpcArgs,
) => {
  const requestParams = request.params;

  let params: ExportZkCertParams;
  try {
    params = exportZkCertParamsSchema.parse(requestParams);
  } catch (error) {
    // TODO: handle this error
    throw error;
  }

  const confirm = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        heading('Export zkCert?'),
        text(
          `Do you want to export a zkCert? (provided to ${origin} for saving it to a file)`,
        ),
      ]),
    },
  });
  if (!confirm) {
    return new ExportZkCertError({
      name: 'RejectedConfirm',
      message: 'User rejected confirmation.',
      cause: request,
    });
  }

  const state = await getState(snap);
  const zkCertForExport = await selectZkCert(
    snap,
    state.zkCerts,
    params.zkCertStandard,
  );
  const zkCertStorageData = state.zkCerts.find(
    (cert) => cert.leafHash === zkCertForExport.leafHash,
  );

  if (!zkCertStorageData) {
    // Handle this error
    throw new Error('');
  }

  const response: ExportZkCertResponse = {
    data: zkCertStorageData,
  };

  return response;
};
