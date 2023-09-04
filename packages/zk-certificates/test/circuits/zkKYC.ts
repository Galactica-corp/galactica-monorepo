/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert } from 'chai';
import hre from 'hardhat';
import { CircuitTestUtils } from 'hardhat-circom';
import { generateZkKYCProofInput, generateSampleZkKYC } from '../../scripts/generateZKKYCInput';

describe('zkKYC Circuit Component', () => {
  let circuit: CircuitTestUtils;
  let sampleInput: any;

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('zkKYC');
    const zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(zkKYC, 0, "0x0");
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
      'main.randomSalt',
      sampleInput.randomSalt.toString()
    );
    assert.propertyVal(
      witness,
      'main.pathIndices',
      BigInt(sampleInput.pathIndices).toString()
    );

    assert.propertyVal(witness, 'main.valid', '1', "proof should be valid");

    const maxValidityLength = 60 * 24 * 60 * 60; // 60 days according to parameter
    assert.propertyVal(
      witness,
      'main.verificationExpiration',
      `${sampleInput.currentTime + maxValidityLength}`,
      "expiration of Verification SBT should be capped by the max validity duration parameter"
    );
  });

  it('the proof is not valid if the expiration time has passed', async () => {
    let forgedInput = { ...sampleInput };
    forgedInput.currentTime = forgedInput.expirationDate + 1;
    const witness = await circuit.calculateLabeledWitness(
      forgedInput,
      sanityCheck
    );
    assert.propertyVal(witness, 'main.valid', '0');
  });
});
