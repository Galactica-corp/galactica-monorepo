/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { readFileSync } from 'fs';
import hre from 'hardhat';
import type { CircuitTestUtils } from 'hardhat-circom';
import { buildPoseidon } from 'circomlibjs';
import { Buffer } from 'buffer';
import { assert, expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);



describe('RLP Int Encoding', () => {
  let circuit: CircuitTestUtils;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/rlpUInt256EncodingCheck.json', 'utf8'),
  );

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('rlpUInt256EncodingCheck');
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('confirms correct encodings', async () => {
    const poseidon = await buildPoseidon();
    const testValues = [
      "0x0000000000000000000000000000000000000000000000000000000000000073",
      "0x0000000000000000000000000000000000000000000000000000000000000400",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000001",
      "0x000000000000000000000000000000000000000000000000000000000000a2b9",
      "0x" + Buffer.from(poseidon(["0x123456"]).buffer).toString('hex'),
      "0x" + Buffer.from(poseidon(["0x45398"]).buffer).toString('hex'),
    ];
    for (const value of testValues) {
      const witness = await circuit.calculateLabeledWitness(valueToInput(value), sanityCheck);
      assert.propertyVal(witness, 'main.out', '1');
    }
  });

  it('rejects invalid encodings', async () => {
    const testInputs = [
      valueToInput("0x0000000000000000000000000000000000000000000000000000000000000400"),
      valueToInput("0x0000000000000000000000000000000000000000000000000000000000000400"),
    ];
    // missing prefix
    testInputs[0].in[0] = 0n;
    testInputs[0].in[1] = 0n;
    // wrong data
    testInputs[1].in[40] = 1n;

    for (const test of testInputs) {
      const witness = await circuit.calculateLabeledWitness(test, sanityCheck);
      assert.propertyVal(witness, 'main.out', '0');
    }
  });

  function valueToInput(value: string): { value: string, in: BigInt[] } {
    const rlpHex = hre.ethers.utils.RLP.encode(value).slice(2);
    const rlpArray = [];
    for (let i = 0; i < rlpHex.length; i++) {
      rlpArray.push(BigInt("0x" + rlpHex[i]));
    }

    return {
      value: value,
      in: rlpArray,
    };
  }
});
