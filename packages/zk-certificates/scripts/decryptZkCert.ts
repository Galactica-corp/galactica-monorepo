/* Copyright (C) 2024 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import { decryptSafely, getEncryptionPublicKey } from '@metamask/eth-sig-util';

import zkCert from '../../../test/encryptedZkCert.json';
import { testHolder } from '../../snap/test/constants.mock';
// This is the zkCert you want to decrypt

/**
 * Script for testing and debugging encrypted ZkCertificates.
 *
 * Instructions:
 * 1. Choose an ecdsa key pair for testing. You can use the one suggested by running this script.
 * 2. Generate your ZkCertificate using the public encryption key.
 * 4. put the encrypted ZkCertificate in a file and import it above as `zkCert`.
 * 5. Run this script with `cd packages/zk-certificates; yarn hardhat run scripts/decryptZkCert.ts` and check the logs.
 */
async function main() {
  // this is the holder you can test with or replace with your own
  const encryptPrivKey = testHolder.encryptionPrivKey;

  console.log('Using the following test holder:');
  const encryptPubKey = getEncryptionPublicKey(encryptPrivKey);
  console.log(`encryption Pub key: ${encryptPubKey}`);

  console.log('Decrypting the zkCert...');

  const decrypted = decryptSafely({
    encryptedData: zkCert,
    privateKey: testHolder.encryptionPrivKey,
  });

  console.log(JSON.stringify(decrypted, null, 2));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
