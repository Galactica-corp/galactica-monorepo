import { RpcMethods } from '@galactica-net/snap-api';

import { defaultSnapOrigin } from '../../../galactica-dapp/src/config';
import {
  ExportRequestParams,
  DeleteRequestParams,
} from '../../../snap/src/types';

// reuse the functions from the galactica-dapp
export {
  getSnap,
  getSnaps,
  connectSnap,
  generateProof,
  isLocalSnap,
} from '../../../galactica-dapp/src/utils/snap';

export const exportZkCert = async () => {
  const params: ExportRequestParams = {
    zkCertStandard: 'gip69',
  };

  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: RpcMethods.ExportZkCert,
        params,
      },
    },
  });
};

export const getHolderCommitment = async () => {
  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: RpcMethods.GetHolderCommitment,
      },
    },
  });
};

export const deleteZkCert = async () => {
  const params: DeleteRequestParams = {
    zkCertStandard: 'gip69',
  };

  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: RpcMethods.DeleteZkCert,
        params,
      },
    },
  });
};
