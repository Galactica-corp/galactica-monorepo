import { createWalletClient, custom } from 'viem';

import { chainMap } from '../config/networks';

export const getWalletClient = async () => {
  const chainIdHex = (await ethereum.request({
    method: 'eth_chainId',
  })) as string | undefined | null;

  if (!chainIdHex) {
    throw new Error('getWalletClient. ethereum.chainId is undefined');
  }

  const chainId = parseInt(chainIdHex, 16).toString(10);

  return createWalletClient({
    chain: chainMap[chainId],
    transport: custom(ethereum),
  });
};
