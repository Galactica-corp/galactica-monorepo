// SPDX-License-Identifier: BUSL-1.1
/**
 * Shortens an EVM address to the form 0x123..456 (better for size limited logs).
 *
 * @param addr - Full EVM address.
 * @returns Shortened address.
 */
export function shortenAddrStr(addr: string): string {
  return `${addr.slice(0, 5)}..${addr.slice(-3)}`;
}

/**
 * Fetch with configurable timeout.
 *
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
