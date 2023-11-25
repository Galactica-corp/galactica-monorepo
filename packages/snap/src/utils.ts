// SPDX-License-Identifier: BUSL-1.1

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
