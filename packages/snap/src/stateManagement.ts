import { Json, SnapsGlobalObject } from '@metamask/snaps-types';
import { HolderData, StorageState, ZkCert } from './types';
import { panel, text } from '@metamask/snaps-ui';

/**
 * Get the state from the snap storage in MetaMask's browser extension.
 *
 * @param snap - The snap for interaction with Metamask.
 * @returns The state.
 */
export async function getState(snap: SnapsGlobalObject): Promise<StorageState> {
  const state_record = await snap.request({
    method: 'snap_manageState',
    params: { operation: "get" },
  }) as Record<string, Json>;
  if (
    state_record === null ||
    state_record === undefined ||
    (typeof state_record === 'object' &&
      (state_record.zkCerts === undefined || state_record.holders === undefined))
  ) {
    return { holders: [], zkCerts: [] };
  }

  const state: StorageState = {
    holders: state_record.holders?.valueOf() as HolderData[],
    zkCerts: state_record.zkCerts?.valueOf() as ZkCert[],
  };
  return state;
}

/**
 * Save updated state to the snap storage in MetaMask's browser extension.
 *
 * @param snap - The snap for interaction with Metamask.
 * @param newState - The new state.
 */
export async function saveState(
  snap: SnapsGlobalObject,
  newState: StorageState,
): Promise<void> {
  const state_record: Record<string, Json> = {
    holders: newState.holders,
    // using unknown to avoid ts error converting ZkCert[] to Json[]
    zkCerts: newState.zkCerts as unknown as Json[],
  };
  // The state is automatically encrypted behind the scenes by MetaMask using snap-specific keys
  await snap.request({
    method: 'snap_manageState',
    params: { operation: 'update', newState: state_record },
  });
}
