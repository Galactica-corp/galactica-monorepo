/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { Buffer } from 'buffer';
import { buildEddsa } from 'circomlibjs';

import { generateEcdhSharedKey } from './keyManagement';
import { buildMimcSponge } from './mimcEncrypt';

/**
 * Encrypts data for fraud investigation, so that it can be posted on-chain and only be decrypted by the user and the institution.
 *
 * @param galaInstitutionPub - Public key of institution.
 * @param userPrivKey - Encryption key derived from user private key.
 * @param providerPubKeyAx - The first part of the provider pubkey as string (decimal string or hex string starting with 0x).
 * @param zkCertHash - Hash of the zkCert.
 * @returns EncryptedData to share for fraud investigation.
 */
export async function encryptFraudInvestigationData(
  galaInstitutionPub: [Uint8Array, Uint8Array],
  userPrivKey: Buffer,
  providerPubKeyAx: string,
  zkCertHash: string,
) {
  const eddsa = await buildEddsa();
  const sharedKey = generateEcdhSharedKey(
    userPrivKey,
    galaInstitutionPub,
    eddsa,
  );
  const mimcjs = await buildMimcSponge();
  // For the provider identification we only use the first part (Ax), because it is unique enough.
  const result = mimcjs.encrypt(providerPubKeyAx, zkCertHash, sharedKey[0]);
  return [
    eddsa.poseidon.F.toObject(result.xL).toString(),
    eddsa.poseidon.F.toObject(result.xR).toString(),
  ];
}

/**
 * Decrypts data for fraud investigation according to the encryption.
 *
 * @param galaInstitutionPrivKey - Private key of institution.
 * @param userPubKey - Public key of user (disclosed in proof, unique for each ZKP).
 * @param encryptedData - Message to decrypt.
 */
export async function decryptFraudInvestigationData(
  galaInstitutionPrivKey: Buffer,
  userPubKey: [Uint8Array, Uint8Array],
  encryptedData: string[],
) {
  const eddsa = await buildEddsa();
  const sharedKey = generateEcdhSharedKey(
    galaInstitutionPrivKey,
    userPubKey,
    eddsa,
  );
  const mimcjs = await buildMimcSponge();
  const result = mimcjs.decrypt(
    encryptedData[0],
    encryptedData[1],
    sharedKey[0],
  );
  return [
    eddsa.poseidon.F.toObject(result.xL).toString(),
    eddsa.poseidon.F.toObject(result.xR).toString(),
  ];
}
