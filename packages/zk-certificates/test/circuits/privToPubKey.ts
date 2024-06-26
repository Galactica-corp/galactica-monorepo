/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert } from 'chai';
import type { Eddsa } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';
import { readFileSync } from 'fs';
import hre, { ethers } from 'hardhat';
import type { CircuitTestUtils } from 'hardhat-circom';

import {
  formatPrivKeyForBabyJub,
  getEddsaKeyFromEthSigner,
} from '../../lib/keyManagement';

describe('Private to public key derivation', () => {
  let circuit: CircuitTestUtils;
  let eddsa: Eddsa;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/privToPubKey.json', 'utf8'),
  );

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('privToPubKey');
    eddsa = await buildEddsa();
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('computes expected pubKey', async () => {
    const [alice] = await ethers.getSigners();

    const privKey = await getEddsaKeyFromEthSigner(alice);
    const privKeyField = formatPrivKeyForBabyJub(privKey, eddsa);

    const pubKey = eddsa.prv2pub(privKey);

    const witness = await circuit.calculateLabeledWitness(
      { privKey: privKeyField },
      sanityCheck,
    );

    assert.propertyVal(witness, 'main.privKey', privKeyField.toString());

    // check resulting output
    for (const i of [0, 1]) {
      assert.propertyVal(
        witness,
        `main.pubKey[${i}]`,
        eddsa.poseidon.F.toObject(pubKey[i]).toString(),
      );
    }
  });
});
