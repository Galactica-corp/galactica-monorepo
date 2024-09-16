/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert } from 'chai';
import sampleInput from '../../circuits/input/exclusion3.json'
import hre from 'hardhat';
import type { CircuitTestUtils } from 'hardhat-circom';

describe.only('Exclusion Circuit Component', () => {
  let circuit: CircuitTestUtils;

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('exclusion3');
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('has expected witness values on success', async () => {
    const witness = await circuit.calculateLabeledWitness(
      sampleInput,
      sanityCheck,
    );

    assert.propertyVal(
      witness,
      'main.value',
      sampleInput.value.toString(),
    );
    // check resulting root as output
    assert.propertyVal(witness, 'main.valid', '1');
  });

  it('should be invalid if a match is in the list', async () => {
    const input = { ...sampleInput };
    for (const value of input.list) {
      input.value = value;
      const witness = await circuit.calculateLabeledWitness(
        input,
        sanityCheck,
      );
      assert.propertyVal(witness, 'main.valid', '0');
    }
  });
});
