/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { generateEcdhSharedKey } from './keyManagement';
import { buildEddsa } from 'circomlibjs';
import { buildMimcSponge } from './mimcEncrypt';

/**
 * @description Generates encrypted data for fraud investigation
 *
 * @param galaInstitutionPubKey: public
 * @param userPrivKey: encryption key derived from user private key
 * @param providerPubKey: the provider pubkey contains 2 uint256, but we only take the first one, it is enough for identification
 * @param zkCertHash:
 * @return encryptedData
 */
export async function encryptFraudInvestigationData(
  galaInstitutionPub: string[],
  userPrivKey: string,
  providerPubKey: string,
  zkCertHash: string
) {
  const eddsa = await buildEddsa();
  const sharedKey = generateEcdhSharedKey(
    userPrivKey,
    galaInstitutionPub,
    eddsa
  );
  const mimcjs = await buildMimcSponge();
  const result = mimcjs.encrypt(providerPubKey, zkCertHash, sharedKey[0]);
  return [
    eddsa.poseidon.F.toObject(result.xL).toString(),
    eddsa.poseidon.F.toObject(result.xR).toString(),
  ];
}

export async function decryptFraudInvestigationData(
  galaInstitutionPrivKey: string,
  userPubKey: string[],
  encryptedData: string[]
) {
  const eddsa = await buildEddsa();
  const sharedKey = generateEcdhSharedKey(
    galaInstitutionPrivKey,
    userPubKey,
    eddsa
  );
  const mimcjs = await buildMimcSponge();
  const result = mimcjs.decrypt(
    encryptedData[0],
    encryptedData[1],
    sharedKey[0]
  );
  return [
    eddsa.poseidon.F.toObject(result.xL).toString(),
    eddsa.poseidon.F.toObject(result.xR).toString(),
  ];
}
