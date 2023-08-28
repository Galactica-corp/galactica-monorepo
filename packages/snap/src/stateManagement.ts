// SPDX-License-Identifier: BUSL-1.1
import { ZkCert } from '@galactica-net/snap-api';
import { Json, SnapsGlobalObject } from '@metamask/snaps-types';

import { HolderData, StorageState } from './types';
import { calculateHolderCommitment } from './zkCertHandler';

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
  let state: StorageState;
  if (
    stateRecord === null ||
    stateRecord === undefined ||
    (typeof stateRecord === 'object' &&
      (stateRecord.zkCerts === undefined || stateRecord.holders === undefined))
  ) {
    state = { holders: [], zkCerts: [] };
  } else {
    state = {
      holders: stateRecord.holders?.valueOf() as HolderData[],
      zkCerts: stateRecord.zkCerts?.valueOf() as ZkCert[],
    };
  }

  // Check that the EdDSA holder key is set up.
  if (state.holders.length === 0) {
    // It is derived from the user's private key handled by Metamask. Meaning that HW wallets are not supported.
    // The plan to support HW wallets is to use the `eth_sign` method to derive the key from a signature.
    // However this plan is currently not supported anymore as discussed here: https://github.com/MetaMask/snaps/discussions/1364#discussioncomment-5719039
    const holderEdDSAKey = await snap.request({
      method: 'snap_getEntropy',
      params: {
        version: 1,
        salt: 'galactica',
      },
    });
    state.holders.push({
      holderCommitment: await calculateHolderCommitment(holderEdDSAKey),
      eddsaKey: holderEdDSAKey,
    });
  }

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
