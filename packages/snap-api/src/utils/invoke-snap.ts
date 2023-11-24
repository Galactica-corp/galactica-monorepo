import { sdkConfig } from '../config';

export const invokeSnap = async <TRequest>(
  request: TRequest,
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  if (!window.ethereum) {
    throw new Error('window.ethereum is undefined');
  }

  return window.ethereum?.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: snapOrigin,
      request,
    },
  });
};
