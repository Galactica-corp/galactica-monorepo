/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { readFileSync } from 'fs';
import hre from 'hardhat';
import { CircuitTestUtils } from 'hardhat-circom';

describe('Polynomial', () => {
  let circuit: CircuitTestUtils;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/polynomial.json', 'utf8')
  );

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('polynomial');
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('computes correct results', async () => {
    const testInputs = [
      {x: [3, 1, 56], coef: [2, 1, 1, 0, 0, 0, 0]},
      {x: [2, 4, 0], coef: [2, 78, 1, 4, 78, 7, 9]},
      {x: [2, 1, 7], coef: [5, 145, 78, 78, 432452, 2, 488]},
    ];
    for (const testInput of testInputs) {
      const witness = await circuit.calculateWitness(testInput, sanityCheck);
      const expected: any = {};
      for (let i = 0; i < testInput.x.length; i++){
        expected[`y[${i}]`] = calculatePolynomial(testInput.x[i], testInput.coef).toString();
      } 
      await circuit.assertOut(witness, expected);
    }
  });

  function calculatePolynomial(x: number, coef: number[]): number {
    let res = 0;
    for (let i = 0; i < coef.length; i++) {
      res += coef[i] * Math.pow(x, i);
    }
    return res;
  }
});
