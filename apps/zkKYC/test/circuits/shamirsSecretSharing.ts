/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import hre from 'hardhat';
import { CircuitTestUtils } from 'hardhat-circom';
import { groth16 } from 'snarkjs';
import { buildEddsa } from "circomlibjs";
import { reconstructShamirSecret } from '../../lib/shamirTools';

describe('Shamir\'s secret sharing', () => {
  let circuit: CircuitTestUtils;
  let eddsa: any;

  const wasmPath = './circuits/build/shamirsSecretSharing.wasm';
  const zkeyPath = './circuits/build/shamirsSecretSharing.zkey';

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/shamirsSecretSharing.json', 'utf8')
  );

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('shamirsSecretSharing');
    eddsa = await buildEddsa();
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('computes fragments that can reconstruct the secret', async () => {
    const testInputs = [
      { secret: 3, salt: 15649468315 },
      { secret: 0, salt: 48946548941654 },
      { secret: 486481648, salt: 16841814841235345 },
    ];
    for (const testInput of testInputs) {

      const { _, publicSignals } = await groth16.fullProve(testInput, wasmPath, zkeyPath);

      expect(reconstructShamirSecret(eddsa.F, 3, [
        [1, publicSignals[0]],
        [2, publicSignals[1]],
        [3, publicSignals[2]]
      ])).to.equal(testInput.secret.toString());
    }
  });

  it('fails to reconstruct with invalid fragments', async () => {
    const testInput = { secret: 3, salt: 15649468315 };
    const { _, publicSignals } = await groth16.fullProve(testInput, wasmPath, zkeyPath);
    expect(reconstructShamirSecret(eddsa.F, 3, [
      [1, publicSignals[0]],
      [2, "345278543"],
      [3, publicSignals[2]]
    ])).to.not.equal(testInput.secret.toString());
  });

  it('same secret no matter which fragments are used', async () => {
    const testInput = { secret: 468146, salt: 45648916549816548 };
    const { _, publicSignals } = await groth16.fullProve(testInput, wasmPath, zkeyPath);
    expect(reconstructShamirSecret(eddsa.F, 3, [
      [1, publicSignals[0]],
      [2, publicSignals[1]],
      [3, publicSignals[2]]
    ])).to.equal(testInput.secret.toString());
    expect(reconstructShamirSecret(eddsa.F, 3, [
      [3, publicSignals[2]],
      [4, publicSignals[3]],
      [5, publicSignals[4]]
    ])).to.equal(testInput.secret.toString());
  });
});
