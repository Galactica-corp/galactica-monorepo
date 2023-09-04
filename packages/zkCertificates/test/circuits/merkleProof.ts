/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert, expect } from 'chai';
import { readFileSync } from 'fs';
import hre from 'hardhat';
import { CircuitTestUtils } from 'hardhat-circom';

describe('Merkle Proof Circuit Component', () => {
  let circuit: CircuitTestUtils;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/merkleProof.json', 'utf8')
  );
  const expectedRoot =
    '9091466005283815162448404040090924144531762766638646206839479435316552583073';

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('merkleProof');
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('has expected witness values', async () => {
    const witness = await circuit.calculateLabeledWitness(
      sampleInput,
      sanityCheck
    );
    assert.propertyVal(witness, 'main.leaf', '0');
    assert.propertyVal(witness, 'main.pathIndices', '5');
    // check resulting root as output
    assert.propertyVal(witness, 'main.root', expectedRoot);
  });

  it('has the correct root as output', async () => {
    const expected = { root: expectedRoot };
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.assertOut(witness, expected);
  });

  it('output changes on having a different leaf', async () => {
    let forgedInput = { ...sampleInput };
    forgedInput.leaf += 1;
    const witness = await circuit.calculateLabeledWitness(
      forgedInput,
      sanityCheck
    );
    assert.notPropertyVal(witness, 'main.root', expectedRoot);
  });

  it('output changes on having a different path', async () => {
    let forgedInput = { ...sampleInput };
    forgedInput.pathIndices -= 1; // flip some bits to have a different path
    const witness = await circuit.calculateLabeledWitness(
      forgedInput,
      sanityCheck
    );
    assert.notPropertyVal(witness, 'main.root', expectedRoot);
  });

  it('output changes on having a different neighbor hashes', async () => {
    let forgedInput = { ...sampleInput };
    forgedInput.pathElements[1] = forgedInput.pathElements[2];
    const witness = await circuit.calculateLabeledWitness(
      forgedInput,
      sanityCheck
    );
    assert.notPropertyVal(witness, 'main.root', expectedRoot);
  });
});
