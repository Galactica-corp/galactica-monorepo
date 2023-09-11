// SPDX-License-Identifier: BUSL-1.1

import { ZKCertificate } from '@galactica-net/zk-certificates';
import { getEncryptionPublicKey, encryptSafely, decryptSafely, EthEncryptedData } from '@metamask/eth-sig-util';
import { SnapsGlobalObject } from '@metamask/rpc-methods';

const encryptionVersion = 'x25519-xsalsa20-poly1305';

/**
 * Create a new encryption key pair for the holder. It is used to encrypt personal details in ZK certificates, for example on the way from guardian to the holder.
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

  return { pubKey: publicKey, privKey: privKey };
}

/**
 * Encrypt a zkCert for exporting
 * @param zkCert - The zkCertificate to encrypt.
 * @param pubKey - The public key for encryption.
 * @returns The encrypted ZKCertificate as EthEncryptedData.
 */
export function encryptZkCert(zkCert: ZKCertificate, pubKey: string): EthEncryptedData {
  const message = JSON.stringify(zkCert);
  const encryptedZkCert = encryptSafely({ publicKey: pubKey, data: message, version: encryptionVersion });
  return encryptedZkCert;
}

/**
 * Decrypt a zkCert. It takes the encrypted zkCert as given by the guardian or exported from the Snap.
 * @param encryptedData - The encrypted zkCert as EthEncryptedData.
 * @param privKey - The private key for decryption.
 * @returns The decrypted ZKCertificate.
 */
export function decryptZkCert(encryptedData: EthEncryptedData, privKey: string): ZKCertificate {
  const decryptedMessage = decryptSafely({ encryptedData: encryptedData, privateKey: privKey });
  const zkCert = JSON.parse(decryptedMessage) as ZKCertificate;
  return zkCert;
}
