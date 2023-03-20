import { Json, SnapsGlobalObject } from '@metamask/snaps-types';

import { HolderData, StorageState, ZkCert } from './types';

/**
 * Get the state from the snap storage in MetaMask's browser extension.
 *
 * @param snap - The snap for interaction with Metamask.
 * @returns The state.
 */
export async function getState(snap: SnapsGlobalObject): Promise<StorageState> {
  const stateRecord = (await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get' },
  })) as Record<string, Json>;
  if (
    stateRecord === null ||
    stateRecord === undefined ||
    (typeof stateRecord === 'object' &&
      (stateRecord.zkCerts === undefined || stateRecord.holders === undefined))
  ) {
    return { holders: [], zkCerts: [] };
  }

  const state: StorageState = {
    holders: stateRecord.holders?.valueOf() as HolderData[],
    zkCerts: stateRecord.zkCerts?.valueOf() as ZkCert[],
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
  const stateRecord: Record<string, Json> = {
    holders: newState.holders,
    // using unknown to avoid ts error converting ZkCert[] to Json[]
    zkCerts: newState.zkCerts as unknown as Json[],
  };
  // The state is automatically encrypted behind the scenes by MetaMask using snap-specific keys
  await snap.request({
    method: 'snap_manageState',
    params: { operation: 'update', newState: stateRecord },
  });
}
