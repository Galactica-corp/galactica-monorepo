/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import type { ZkCertRegistered } from '@galactica-net/galactica-types';
import { KnownZkCertStandard } from '@galactica-net/galactica-types';
import { getEncryptionPublicKey } from '@metamask/eth-sig-util';
import { expect } from 'chai';
import { buildEddsa } from 'circomlibjs';
import { getRandomValues } from 'crypto';

import {
  createHolderCommitment,
  decryptZkCert,
  encryptZkCert,
} from '../../lib';

describe('Encryption', () => {
  it('decrypts what was encrypted', async () => {
    const eddsa = await buildEddsa();

    const eddsaPrivateKey = new Uint8Array(32);
    getRandomValues(eddsaPrivateKey);

    const holderCommitment = createHolderCommitment(
      eddsa,
      Buffer.from(eddsaPrivateKey),
    );

    const content = {
      holderCommitment,
      zkCertStandard: KnownZkCertStandard.Rey,
      randomSalt: '0',
      expirationDate: 1,
      content: {
        xUsername: '0000',
        xID: '0',

        // BUG: when parsing, substituting missing values for defaults breaks exact match
        reyFaction: 0,
        reyScoreAll: 0,
        reyScoreGalactica: 0,
      },
      providerData: {
        ax: '0',
        ay: '0',
        s: '0',
        r8x: '0',
        r8y: '0',
      },
      contentHash: '0',
      leafHash: '0',
      did: '0',
      registration: {
        address: '0',
        chainID: 1,
        revocable: true,
        leafIndex: 1,
      },
      merkleProof: {
        leaf: '0',
        pathElements: ['0'],
        leafIndex: 1,
      },
    } satisfies ZkCertRegistered;

    const encryptionPrivateKey = new Uint8Array(32);
    getRandomValues(encryptionPrivateKey);

    const encryptionPrivateKeyHex =
      Buffer.from(encryptionPrivateKey).toString('hex');
    const encryptionPublicKey = getEncryptionPublicKey(encryptionPrivateKeyHex);

    const encrypted = encryptZkCert(
      content,
      encryptionPublicKey,
      holderCommitment,
    );
    const decrypted = decryptZkCert(encrypted, encryptionPrivateKeyHex);

    expect(decrypted).to.deep.equal(content);
  });
});
