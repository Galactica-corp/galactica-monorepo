/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert, expect } from 'chai';
import type { Eddsa } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';
import { readFileSync } from 'fs';
import hre, { ethers } from 'hardhat';
import type { CircuitTestUtils } from 'hardhat-circom';

import {
  formatPrivKeyForBabyJub,
  generateEcdhSharedKey,
  getEddsaKeyFromEthSigner,
} from '../../lib/keyManagement';

describe('ECDH shared key derivation', () => {
  let circuit: CircuitTestUtils;
  let eddsa: Eddsa;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/ecdh.json', 'utf8'),
  );

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('ecdh');
    eddsa = await buildEddsa();
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('generates unique shared ECDH key for alice and bob', async () => {
    const [alice, bob] = await ethers.getSigners();

    const alicePriv = await getEddsaKeyFromEthSigner(alice);
    const bobPriv = await getEddsaKeyFromEthSigner(bob);

    const alicePub = eddsa.prv2pub(alicePriv);
    const bobPub = eddsa.prv2pub(bobPriv);

    // same key for alice and bob
    const sharedKeyAB = generateEcdhSharedKey(alicePriv, bobPub, eddsa);
    const sharedKeyBA = generateEcdhSharedKey(bobPriv, alicePub, eddsa);
    for (const i of [0, 1]) {
      expect(sharedKeyAB[i]).to.equal(sharedKeyBA[i]);
    }

    const witness = await circuit.calculateLabeledWitness(
      {
        privKey: formatPrivKeyForBabyJub(alicePriv, eddsa),
        pubKey: bobPub.map((pubKey: any) =>
          eddsa.poseidon.F.toObject(pubKey).toString(),
        ),
      },
      sanityCheck,
    );

    for (const i of [0, 1]) {
      assert.propertyVal(witness, `main.sharedKey[${i}]`, sharedKeyAB[i]);
    }
  });
});
