/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert } from 'chai';
import hre from 'hardhat';
import { CircuitTestUtils } from 'hardhat-circom';
import { generateSampleZkKYC, generateZkKYCProofInput } from '../../scripts/generateZKKYCInput';
import { ZKCertificate } from '../../lib';

describe('Age Proof combined with zkKYC Circuit Component', () => {
  let circuit: CircuitTestUtils;

  let zkKYC: ZKCertificate;
  let sampleInput: any;

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('ageProofZkKYC');
    // inputs to create proof
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(zkKYC, 0, "0x0");
    const today = new Date(Date.now());
    sampleInput.currentYear = today.getUTCFullYear();
    sampleInput.currentMonth = today.getUTCMonth() + 1;
    sampleInput.currentDay = today.getUTCDate();
    sampleInput.ageThreshold = 18;

    // advance time a bit to set it later in the test
    sampleInput.currentTime += 100;

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

    assert.propertyVal(
      witness,
      'main.ageThreshold',
      sampleInput.ageThreshold.toString()
    );
    // check resulting root as output
    assert.propertyVal(witness, 'main.valid', '1');
  });
});
