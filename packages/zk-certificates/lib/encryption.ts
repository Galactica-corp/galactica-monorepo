/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import type {
  EncryptedZkCert,
  ZkCertRegistered,
  ZkCertStandard,
} from '@galactica-net/galactica-types';
import { ENCRYPTION_VERSION } from '@galactica-net/galactica-types';
import { decryptSafely, encryptSafely } from '@metamask/eth-sig-util';
import type { AnySchema } from 'ajv';

import { chooseSchema, parseZkCert } from './zkCertificate';

/**
 * Encrypt a zkCert for exporting.
 *
 * @param zkCert - The ZkCertRegistered to encrypt.
 * @param pubKey - The public key for encryption. Hex-encoded X25519 public key.
 * @param holderCommitment - The holder commitment to associate the zkCert with the holder who can decrypt it.
 * @returns The encrypted ZkCertRegistered as EthEncryptedData.
 */
export function encryptZkCert(
  zkCert: ZkCertRegistered<Record<string, unknown>>,
  pubKey: string,
  holderCommitment: string,
): EncryptedZkCert {
  return {
    ...encryptSafely({
      publicKey: pubKey,
      data: zkCert,
      version: ENCRYPTION_VERSION,
    }),
    holderCommitment,
  };
}

/**
 * Decrypt a zkCert. It takes the encrypted ZkCertRegistered as given by the guardian or exported from the Snap.
 *
 * @param encryptedZkCert - The encrypted zkCert as EthEncryptedData.
 * @param privateKey - The private key for decryption. Hex-encoded X25519 private key that is 32 random bytes.
 * @param customSchema - Optional custom schema to use for parsing the zkCert.
 * @returns The decrypted ZkCertRegistered.
 * @throws ImportZkCertError If the zkCert is not in the right format or the decryption fails.
 */
export function decryptZkCert(
  encryptedZkCert: EncryptedZkCert,
  privateKey: string,
  customSchema?: AnySchema,
): ZkCertRegistered<Record<string, unknown>> {
  const decryptedMessage = decryptSafely({
    encryptedData: encryptedZkCert,
    privateKey,
  });

  // decryptSafely says it would return a string, but it actually returns what came out of JSON.parse().
  // (encoded here:
  // https://github.com/MetaMask/eth-sig-util/blob/10206bf2f16f0b47b1f2da9a9cfbb39c6a7a7800/src/encryption.ts#L141
  //
  // decoded here:
  // https://github.com/MetaMask/eth-sig-util/blob/10206bf2f16f0b47b1f2da9a9cfbb39c6a7a7800/src/encryption.ts#L234)
  // So we can cast it to ZkCertRegistered here.
  const decrypted = decryptedMessage as unknown as Record<string, unknown> & {
    zkCertStandard: ZkCertStandard;
  };

  const schema = chooseSchema(decrypted.zkCertStandard, customSchema);
  return parseZkCert(decrypted, schema);
}
