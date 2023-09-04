/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert, expect } from 'chai';
import { readFileSync } from 'fs';
import hre from 'hardhat';
import { CircuitTestUtils } from 'hardhat-circom';
import { buildEddsa } from "circomlibjs";
import { ethers } from "hardhat";

import { getEddsaKeyFromEthSigner, generateEcdhSharedKey } from "../../lib/keyManagement";
import { eddsaKeyGenerationMessage } from "@galactica-net/galactica-types";

describe('Key Management', () => {
  let babyjub, eddsa: any;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/ownership.json', 'utf8')
  );

  const sanityCheck = true;

  before(async () => {
    eddsa = await buildEddsa();
    babyjub = await eddsa.babyJub;
  });

  it('can generate EdDSA key from signature', async () => {
    const holder = (await ethers.getSigners())[6];

    const holderEdDSAKey = await getEddsaKeyFromEthSigner(holder);

    expect(ethers.utils.recoverAddress(ethers.utils.hashMessage(eddsaKeyGenerationMessage), holderEdDSAKey))
      .to.equal(holder.address);
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
    for (let i in [0, 1]) {
      expect(sharedKeyAB[i]).to.equal(sharedKeyBA[i]);
    }

    // different keys for different participants
    const sharedKeyAC = generateEcdhSharedKey(alicePriv, charliePub, eddsa);
    for (let i in [0, 1]) {
      expect(sharedKeyAB[i]).to.not.equal(sharedKeyAC[i]);
    }
  });
});
