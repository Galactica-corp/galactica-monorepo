import { SnapProvider } from '@metamask/snap-types';
import { StorageState } from './types';

/**
 * Get the state from the snap storage in MetaMask's browser extension.
 *
 * @returns The state.
 */
export async function getState(wallet: SnapProvider): Promise<StorageState> {
  const state = await wallet.request<StorageState>({
    method: 'snap_manageState',
    params: ['get'],
  });
  if (
    state === null ||
    (typeof state === 'object' &&
      (state.zkCerts === undefined || state.holders === undefined))
  ) {
    return { holders: [], zkCerts: [] };
  }
  return state as StorageState;
}

/**
 * Save updated state to the snap storage in MetaMask's browser extension.
 *
 * @param newState - The new state.
 */
export async function saveState(wallet: SnapProvider, newState: StorageState): Promise<void> {
  // The state is automatically encrypted behind the scenes by MetaMask using snap-specific keys
  await wallet.request({
    method: 'snap_manageState',
    params: ['update', newState],
  });
}
