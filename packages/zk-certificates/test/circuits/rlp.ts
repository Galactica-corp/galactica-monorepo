/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { readFileSync } from 'fs';
import hre from 'hardhat';
import type { CircuitTestUtils } from 'hardhat-circom';
import { Buffer } from 'buffer';
import { assert } from 'chai';


describe.only('RLP Int Encoding', () => {
  let circuit: CircuitTestUtils;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/rlpIntEncodingCheck.json', 'utf8'),
  );

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('rlpIntEncodingCheck');
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('confirms correct encodings', async () => {
    const testValues = ["0x73", "0x0400", "0x00", "0x01", "0xffff", "0xa2b9"];
    const rlpMaxLen = 3;
    for (const value of testValues) {
      const rlpHex = hre.ethers.utils.RLP.encode(value);
      const rlpBuffer = Buffer.from(rlpHex.slice(2), 'hex');
      const rlpLen = rlpBuffer.length;
      const rlpBytes = Array.from(rlpBuffer).map((byte) => BigInt(byte));
      for (let i = rlpBuffer.length; i < rlpMaxLen; i++) {
        rlpBytes.push(0n);
      }

      const testInput = {
        value: value,
        rlpLen: rlpLen,
        in: rlpBytes.map((byte) => BigInt(byte)),
      };
      const witness = await circuit.calculateLabeledWitness(testInput, sanityCheck);
      assert.propertyVal(witness, 'main.out', '1');
    }
  });

  it('rejects invalid encodings', async () => {
    const testInputs = [
      { value: "0x0400", rlpLen: 2, in: ["0x04", "0x00", "0x00"] },
      { value: "0x15", rlpLen: 2, in: ["0x81", "0x15", "0x00"] },
      { value: "0x0400", rlpLen: 2, in: ["0x82", "0x04", "0x02"] },
    ];
    for (const test of testInputs) {
      console.log('testInput', test);
      const witness = await circuit.calculateLabeledWitness(test, sanityCheck);
      assert.propertyVal(witness, 'main.out', '0');
    }
  });
});
