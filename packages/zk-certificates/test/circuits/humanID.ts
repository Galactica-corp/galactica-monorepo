/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { humanIDFieldOrder } from '@galactica-net/galactica-types';
import { assert } from 'chai';
import { buildPoseidon } from 'circomlibjs';
import { readFileSync } from 'fs';
import hre from 'hardhat';
import type { CircuitTestUtils } from 'hardhat-circom';

describe('HumanID Component', () => {
  let circuit: CircuitTestUtils;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/humanID.json', 'utf8'),
  );

  let expectedID: string;

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('humanID');

    const poseidon = await buildPoseidon();
    expectedID = poseidon.F.toObject(
      poseidon(
        humanIDFieldOrder.map((field) => sampleInput[field]),
        undefined,
        1,
      ),
    ).toString();
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('has expected witness values', async () => {
    const witness = await circuit.calculateLabeledWitness(
      sampleInput,
      sanityCheck,
    );
    assert.propertyVal(witness, 'main.surname', sampleInput.surname);
    assert.propertyVal(
      witness,
      'main.yearOfBirth',
      sampleInput.yearOfBirth.toString(),
    );
    assert.propertyVal(witness, 'main.citizenship', sampleInput.citizenship);
    assert.propertyVal(witness, 'main.dAppAddress', sampleInput.dAppAddress);
    // check resulting output
    assert.propertyVal(witness, 'main.humanID', expectedID);
  });

  it('has the id hashed correctly', async () => {
    const expected = { humanID: expectedID };
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.assertOut(witness, expected);
  });

  it('output changes on any difference', async () => {
    for (const field of humanIDFieldOrder) {
      const forgedInput = { ...sampleInput };
      forgedInput[field] += 1;
      const witness = await circuit.calculateLabeledWitness(
        forgedInput,
        sanityCheck,
      );
      assert.notPropertyVal(witness, 'main.humanID', expectedID);
    }
  });
});
