import type { BaseProvider } from '@metamask/providers';
import { createWalletClient, custom } from 'viem';

import { chainMap } from '../config/networks';

export const getWalletClient = async (ethereumProvider?: BaseProvider) => {
  const eth = ethereumProvider ?? ethereum;
  const chainIdHex = (await eth.request({
    method: 'eth_chainId',
  })) as string | undefined | null;

  if (!chainIdHex) {
    throw new Error('getWalletClient. ethereum.chainId is undefined');
  }

  const chainId = parseInt(chainIdHex, 16).toString(10);

  return createWalletClient({
    chain: chainMap[chainId],
    transport: custom(eth),
  });
};
