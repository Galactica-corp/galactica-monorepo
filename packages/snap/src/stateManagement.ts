// SPDX-License-Identifier: BUSL-1.1
import { GenericError, ZkCertRegistered } from '@galactica-net/snap-api';
import { getEddsaKeyFromEntropy } from '@galactica-net/zk-certificates';
import { Json, SnapsGlobalObject } from '@metamask/snaps-types';
import { Buffer } from 'buffer';

import { createEncryptionKeyPair } from './encryption';
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
    const holderJSONData = stateRecord.holders?.valueOf() as {
      holderCommitment: string;
      eddsaKeyHex: string;
      encryptionPubKey: string;
      encryptionPrivKey: string;
    }[];

    state = {
      holders: holderJSONData.map((holder) => ({
        holderCommitment: holder.holderCommitment,
        eddsaKey: Buffer.from(holder.eddsaKeyHex, 'hex'),
        encryptionPubKey: holder.encryptionPubKey,
        encryptionPrivKey: holder.encryptionPrivKey,
      })),
      zkCerts: stateRecord.zkCerts?.valueOf() as ZkCertRegistered[],
    };
    if (
      stateRecord.merkleServiceURL !== undefined &&
      stateRecord.merkleServiceURL?.valueOf() !== ''
    ) {
      state.merkleServiceURL =
        stateRecord.merkleServiceURL?.valueOf() as string;
    }
  }

  // Check that the EdDSA holder key is set up.
  if (state.holders.length === 0) {
    // It is derived from the user's private key handled by Metamask. Meaning that HW wallets are not supported.
    // The plan to support HW wallets is to use the `eth_sign` method to derive the key from a signature.
    // However this plan is currently not supported anymore as discussed here: https://github.com/MetaMask/snaps/discussions/1364#discussioncomment-5719039
    const entropy = await snap.request({
      method: 'snap_getEntropy',
      params: {
        version: 1,
        salt: 'galactica',
      },
    });
    const encryptionKeyPair = await createEncryptionKeyPair(snap);
    const holderEdDSAKey = getEddsaKeyFromEntropy(entropy);
    state.holders.push({
      holderCommitment: await calculateHolderCommitment(holderEdDSAKey),
      eddsaKey: holderEdDSAKey,
      encryptionPubKey: encryptionKeyPair.pubKey,
      encryptionPrivKey: encryptionKeyPair.privKey,
    });
  } else if (state.holders[0].encryptionPubKey === undefined) {
    // migrate old holder state without encryption keys
    const encryptionKeyPair = await createEncryptionKeyPair(snap);
    state.holders[0].encryptionPubKey = encryptionKeyPair.pubKey;
    state.holders[0].encryptionPrivKey = encryptionKeyPair.privKey;
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
    holders: newState.holders.map((holder) => ({
      holderCommitment: holder.holderCommitment,
      eddsaKey: holder.eddsaKey.toString('hex'),
    })),
    // using unknown to avoid ts error converting ZkCert[] to Json[]
    zkCerts: newState.zkCerts as unknown as Json[],
    merkleServiceURL: newState.merkleServiceURL
      ? newState.merkleServiceURL
      : '',
  };
  // The state is automatically encrypted behind the scenes by MetaMask using snap-specific keys
  await snap.request({
    method: 'snap_manageState',
    params: { operation: 'update', newState: stateRecord },
  });
}

/**
 * Get holder matching a holder commitment from the holderData array.
 *
 * @param holderCommitment - The holder commitment to search for.
 * @param holders - The holderData array to search in.
 * @returns The holderData.
 * @throws Error if no holder is found.
 */
export function getHolder(
  holderCommitment: string,
  holders: HolderData[],
): HolderData {
  const holder = holders.find(
    (holderData) => holderData.holderCommitment === holderCommitment,
  );
  if (holder === undefined) {
    throw new GenericError({
      name: 'MissingHolder',
      message: `No holder found for commitment ${holderCommitment} Please use Metamask with the same mnemonic as when you created this holder commitment.`,
    });
  }
  return holder;
}

/**
 * Get zkCert matching a leafHash from the zkCert array.
 *
 * @param leafHash - The holder commitment to search for.
 * @param zkCerts - The holderData array to search in.
 * @returns The holderData.
 * @throws Error if no holder is found.
 */
export function getZkCert(
  leafHash: string,
  zkCerts: ZkCertRegistered[],
): ZkCertRegistered {
  const res = zkCerts.find((zkCert) => zkCert.leafHash === leafHash);
  if (res === undefined) {
    throw new GenericError({
      name: 'MissingZkCert',
      message: `ZkCert ${leafHash} Could not be found. Please import it first.`,
    });
  }
  return res;
}
