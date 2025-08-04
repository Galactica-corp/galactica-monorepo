// SPDX-License-Identifier: BUSL-1.1

import type { BaseProvider } from '@metamask/providers';

/**
 * Fetch with configurable timeout.
 * @param resource - URL to fetch from.
 * @param options - Fetch options, including timeout field.
 * @returns Fetch response.
 */
export async function fetchWithTimeout(resource: string, options: any = {}) {
  const { timeout = 10000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);
  return response;
}

/**
 * Remove the protocol from a URL.
 * Implemented because the snap blocks http:// in dialogs, breaking some confirmation messages when testing locally.
 * @param url - URL to prune.
 * @returns URL without protocol prefix.
 */
export function stripURLProtocol(url: string): string {
  return url.replace(/(^\w+:|^)\/\//u, '');
}

/**
 * Set the active Ethereum chain for the Snap.
 * @param chainId - The chain ID to switch to.
 * @param ethereum - Ethereum provider to switch the chain for.
 */
export async function switchChain(chainId: number, ethereum: BaseProvider) {
  await ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: `0x${chainId.toString(16)}` }],
  });
}
