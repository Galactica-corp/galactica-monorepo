// SPDX-License-Identifier: BUSL-1.1

import { ENCRYPTION_VERSION } from '@galactica-net/galactica-types';
import type {
  EncryptedZkCert,
  ZkCertRegistered,
  ZkCertStandard,
} from '@galactica-net/snap-api';
import { ImportZkCertError } from '@galactica-net/snap-api';
import { padZkCertForEncryption } from '@galactica-net/zk-certificates';
import {
  decryptSafely,
  encryptSafely,
  getEncryptionPublicKey,
} from '@metamask/eth-sig-util';
import type { SnapsGlobalObject } from '@metamask/snaps-types';

/**
 * Create a new encryption key pair for the holder. It is used to encrypt personal details in ZK certificates, for example on the way from guardian to the holder.
 *
 * @param snap - The snap for interaction with Metamask.
 * @returns The public and private key.
 */
export async function createEncryptionKeyPair(snap: SnapsGlobalObject) {
  // It is derived from the user's private key handled by Metamask. Meaning that HW wallets are not supported.
  // The plan to support HW wallets is to use the `eth_sign` method to derive the key from a signature.
  // However this plan is currently not supported anymore as discussed here: https://github.com/MetaMask/snaps/discussions/1364#discussioncomment-5719039
  const entropy = await snap.request({
    method: 'snap_getEntropy',
    params: {
      version: 1,
      salt: 'galactica-encryption2',
    },
  });
  const privKey = entropy.slice(2); // remove 0x prefix
  const publicKey = getEncryptionPublicKey(privKey);
  return { pubKey: publicKey, privKey };
}

/**
 * Encrypt a zkCert for exporting.
 *
 * @param zkCert - The ZkCertRegistered to encrypt.
 * @param pubKey - The public key for encryption.
 * @param holderCommitment - The holder commitment to associate the zkCert with the holder who can decrypt it.
 * @returns The encrypted ZkCertRegistered as EthEncryptedData.
 */
export function encryptZkCert(
  zkCert: ZkCertRegistered,
  pubKey: string,
  holderCommitment: string,
): EncryptedZkCert {
  padZkCertForEncryption(zkCert);

  const encryptedZkCert = encryptSafely({
    publicKey: pubKey,
    data: zkCert,
    version: ENCRYPTION_VERSION,
  }) as EncryptedZkCert;
  encryptedZkCert.holderCommitment = holderCommitment;
  return encryptedZkCert;
}

/**
 * Decrypt a zkCert. It takes the encrypted ZkCertRegistered as given by the guardian or exported from the Snap.
 *
 * @param encryptedZkCert - The encrypted zkCert as EthEncryptedData.
 * @param privKey - The private key for decryption.
 * @returns The decrypted ZkCertRegistered.
 * @throws If the zkCert is not in the right format or the decryption fails.
 */
export function decryptMessageToObject(
  encryptedZkCert: EncryptedZkCert,
  privKey: string,
) {
  const decryptedMessage = decryptSafely({
    encryptedData: encryptedZkCert,
    privateKey: privKey,
  });
  // decryptSafely says it would return a string, but it actually returns what came out of JSON.parse().
  // (https://github.com/MetaMask/eth-sig-util/blob/10206bf2f16f0b47b1f2da9a9cfbb39c6a7a7800/src/encryption.ts#L234)
  // So we can cast it to ZkCertRegistered here.
  const decrypted = decryptedMessage as unknown as {
    zkCertStandard: ZkCertStandard;
  };
  return decrypted;
}

/**
 * Checks if an imported EncryptedZkCert has the right format.
 *
 * @param encryptedZkCert - The encrypted zkCert as EthEncryptedData.
 * @throws If the format is not correct.
 */
export function checkEncryptedZkCertFormat(encryptedZkCert: EncryptedZkCert) {
  if (
    !encryptedZkCert?.version ||
    !encryptedZkCert?.nonce ||
    !encryptedZkCert?.ephemPublicKey ||
    !encryptedZkCert?.ciphertext
  ) {
    throw new ImportZkCertError({
      name: 'FormatError',
      message: 'The imported zkCert is not in the EthEncryptedData format.',
    });
  }
  if (!encryptedZkCert.holderCommitment) {
    throw new ImportZkCertError({
      name: 'FormatError',
      message: 'The imported zkCert does not contain a holder commitment.',
    });
  }
}
