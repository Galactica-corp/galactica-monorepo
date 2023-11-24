import { config } from '../config';

export const invokeSnap = async <T>(
  request: T,
  snapOrigin: string = config.defaultSnapOrigin,
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
