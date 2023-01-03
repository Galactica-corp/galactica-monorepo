import { HolderData, StorageState } from './types';

/**
 *
 */
export async function getState(): Promise<StorageState> {
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
 *
 * @param newState
 */
export async function saveState(newState: StorageState): Promise<void> {
  // The state is automatically encrypted behind the scenes by MetaMask using snap-specific keys
  await wallet.request({
    method: 'snap_manageState',
    params: ['update', newState],
  });
}
