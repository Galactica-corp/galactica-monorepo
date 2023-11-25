/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { expect } from 'chai';
import type { Eddsa } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';
import { ethers } from 'hardhat';

import { hashStringToFieldNumber } from '../../lib';
import {
  getEddsaKeyFromEthSigner,
  generateEcdhSharedKey,
} from '../../lib/keyManagement';

describe('Key Management', () => {
  let eddsa: Eddsa;

  before(async () => {
    eddsa = await buildEddsa();
  });

  it('can generate working EdDSA keys from signature', async () => {
    const holder = (await ethers.getSigners())[6];

    const holderEdDSAKey = await getEddsaKeyFromEthSigner(holder);
    const pubKey = eddsa.prv2pub(holderEdDSAKey);

    // test if the keys can sign and verify a message
    const message = eddsa.F.e(
      hashStringToFieldNumber('test message', eddsa.poseidon),
    );
    const signature = eddsa.signPoseidon(holderEdDSAKey, message);

    expect(eddsa.verifyPoseidon(message, signature, pubKey)).to.be.true;
  });

  it('generates unique shared ECDH key for alice and bob', async () => {
    const [alice, bob, charlie] = await ethers.getSigners();

    const alicePriv = await getEddsaKeyFromEthSigner(alice);
    const bobPriv = await getEddsaKeyFromEthSigner(bob);
    const charliePriv = await getEddsaKeyFromEthSigner(charlie);

    const alicePub = eddsa.prv2pub(alicePriv);
    const bobPub = eddsa.prv2pub(bobPriv);
    const charliePub = eddsa.prv2pub(charliePriv);

    // same key for alice and bob
    const sharedKeyAB = generateEcdhSharedKey(alicePriv, bobPub, eddsa);
    const sharedKeyBA = generateEcdhSharedKey(bobPriv, alicePub, eddsa);
    for (const i of [0, 1]) {
      expect(sharedKeyAB[i]).to.equal(sharedKeyBA[i]);
    }

    // different keys for different participants
    const sharedKeyAC = generateEcdhSharedKey(alicePriv, charliePub, eddsa);
    for (const i of [0, 1]) {
      expect(sharedKeyAB[i]).to.not.equal(sharedKeyAC[i]);
    }
  });
});
