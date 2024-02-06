/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { readFileSync } from 'fs';
import hre from 'hardhat';
import type { CircuitTestUtils } from 'hardhat-circom';
import { Buffer } from 'buffer';
import { assert, expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);



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
    const testValues = [
      "0x0000000000000000000000000000000000000000000000000000000000000073",
      "0x0000000000000000000000000000000000000000000000000000000000000400",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000001",
      "0x000000000000000000000000000000000000000000000000000000000000a2b9",
    ];
    const rlpMaxLen = 33;
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
      // missing prefix
      { value: "0x0400", rlpLen: 2, in: ["0x04", "0x00"].concat(Array(31).fill("0x00")) },
      // should be without prefix
      { value: "0x15", rlpLen: 2, in: ["0x81", "0x15"].concat(Array(31).fill("0x00")) },
      // wrong data
      { value: "0x0400", rlpLen: 2, in: ["0x82", "0x04", "0x02"].concat(Array(30).fill("0x00")) },
    ];
    for (const test of testInputs) {
      const witness = await circuit.calculateLabeledWitness(test, sanityCheck);
      assert.propertyVal(witness, 'main.out', '0');
    }
  });

  it('fails to use non field value', async () => {
    const test = {
      value: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      rlpLen: 33,
      in: [0xa0].concat(Array(32).fill("0xff"))
    };
    await expect(
      circuit.calculateLabeledWitness(test, sanityCheck),
    ).to.be.rejectedWith('Error: Assert Failed.');
  });
});
