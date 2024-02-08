/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { readFileSync } from 'fs';
import hre from 'hardhat';
import type { CircuitTestUtils } from 'hardhat-circom';
import { buildPoseidon } from 'circomlibjs';
import { hashMessage } from '../../lib/poseidon';
import { Buffer } from 'buffer';
import { assert, expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);



describe.only('Poseidon Sponge Circuit', () => {
  let circuit: CircuitTestUtils;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/poseidonSponge.json', 'utf8'),
  );

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('poseidonSponge');
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('computes the same hash as the reference implementation', async () => {

    const poseidon = await buildPoseidon();
    const expected = hashMessage(poseidon, sampleInput.inputs);

    const witness = await circuit.calculateLabeledWitness(sampleInput, sanityCheck);
    assert.propertyVal(witness, 'main.out', poseidon.F.toString(expected));
  });
});
