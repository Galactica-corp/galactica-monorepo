import { RpcMethods } from '../../../snap/src/rpcEnums';
import { ExportRequestParams } from '../../../snap/src/types';
import { defaultSnapOrigin } from '../../../galactica-dapp/src/config';

// reuse the functions from the galactica-dapp
export { getSnap, getSnaps, connectSnap, generateProof, isLocalSnap } from '../../../galactica-dapp/src/utils/snap';

/**
 * Invoke the methods from the example snap.
 */

export const setupHoldingKey = async () => {
  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: RpcMethods.SetupHoldingKey,
      },
    },
  });
};

export const clearStorage = async () => {
  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: RpcMethods.ClearStorage,
      },
    },
  });
};

export const importZkCert = async (zkCertJson: any) => {
  console.log({ zkCert: zkCertJson });
  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: RpcMethods.ImportZkCert,
        params: { zkCert: zkCertJson },
      },
    },
  });
};

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
