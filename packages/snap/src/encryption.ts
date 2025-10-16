/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// SPDX-License-Identifier: BUSL-1.1

import type { EncryptedZkCert } from '@galactica-net/snap-api';
import { ImportZkCertError } from '@galactica-net/snap-api';
import { getEncryptionPublicKey } from '@metamask/eth-sig-util';
import type { SnapsProvider } from '@metamask/snaps-sdk';

/**
 * Create a new encryption key pair for the holder. It is used to encrypt personal details in ZK certificates, for example on the way from guardian to the holder.
 *
 * @param snap - The snap for interaction with Metamask.
 * @returns The public and private key.
 */
export async function createEncryptionKeyPair(snap: SnapsProvider) {
  // It is derived from the user's private key handled by Metamask. Meaning that HW wallets are not supported.
  // The plan to support HW wallets is to use the `eth_sign` method to derive the key from a signature.
  // However, this plan is currently not supported anymore as discussed here: https://github.com/MetaMask/snaps/discussions/1364#discussioncomment-5719039
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
