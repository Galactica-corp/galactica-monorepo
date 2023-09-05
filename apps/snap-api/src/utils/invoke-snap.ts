import { GalacticaMethod } from '@galactica-net/core';
import { sdkConfig } from '../config';

export const invokeSnap = async <T extends { method: GalacticaMethod }>(
  request: T,
) => {
  if (!window.ethereum) {
    throw new Error('window.ethereum is undefined');
  }

  return window.ethereum?.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: sdkConfig.defaultSnapOrigin,
      request,
    },
  });
};
