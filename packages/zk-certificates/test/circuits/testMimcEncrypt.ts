/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert } from 'chai';
import { readFileSync } from 'fs';
import { circuitTest, ethers } from 'hardhat';
import type { CircuitTestUtils } from 'hardhat-circom';

import { buildMimcSponge } from '../../lib/mimcEncrypt';

describe('MiMC Sponge Encryption test', function () {
  const sanityCheck = true;

  describe('JS code', function () {
    let xL: any, xR: any, key: any, keyW: any;
    let mimcjs: any;
    let field: any;

    before(async () => {
      mimcjs = await buildMimcSponge();
      field = mimcjs.F;

      xL = field.e(ethers.id('left').toString());
      xR = field.e(ethers.id('right').toString());
      key = field.e(ethers.id('key').toString());
      keyW = field.e(ethers.id('keyW').toString());
    });

    it('should encrypt and decrypt with same key', async () => {
      const ct = mimcjs.encrypt(xL, xR, key);
      const pt = mimcjs.decrypt(ct.xL, ct.xR, key);
      assert.equal(xL.toString(), pt.xL.toString());
      assert.equal(xR.toString(), pt.xR.toString());
    });

    it('should fail to encrypt and decrypt with different keys', async () => {
      const ct = mimcjs.encrypt(xL, xR, key);
      const pt = mimcjs.decrypt(ct.xL, ct.xR, keyW);
      assert.notEqual(xL.toString(), pt.xL.toString());
      assert.notEqual(xR.toString(), pt.xR.toString());
    });
  });

  describe('Circuit Encrypt+Decrypt', function () {
    let circuit: CircuitTestUtils;
    let sampleInput: any;

    before(async () => {
      circuit = await circuitTest.setup('mimcEnDecrypt');
      sampleInput = JSON.parse(
        readFileSync('./circuits/input/mimcEnDecrypt.json', 'utf8'),
      );
    });

    it('should encrypt and decrypt a single message', async () => {
      const witness = await circuit.calculateLabeledWitness(
        sampleInput,
        sanityCheck,
      );

      // check resulting root as output
      assert.propertyVal(witness, 'main.xL_out', sampleInput.xL_in);
      assert.propertyVal(witness, 'main.xR_out', sampleInput.xR_in);
    });

    it('should fail decrypt with wrong key', async () => {
      const wrongInput = sampleInput;
      wrongInput.k_two = '32547';

      const witness = await circuit.calculateLabeledWitness(
        wrongInput,
        sanityCheck,
      );

      // check resulting root as output
      assert.notPropertyVal(witness, 'main.xL_out', sampleInput.xL_in);
      assert.notPropertyVal(witness, 'main.xR_out', sampleInput.xR_in);
    });
  });

  describe('Circuit Encrypt', function () {
    let circuit: CircuitTestUtils;
    let sampleInput: any;
    let xL: any, xR: any, key: any;
    let mimcjs: any;
    let field: any;

    before(async () => {
      // setup mimc circuit
      circuit = await circuitTest.setup('mimcEncrypt');
      sampleInput = JSON.parse(
        readFileSync('./circuits/input/mimcEncrypt.json', 'utf8'),
      );

      // setup mimcjs
      mimcjs = await buildMimcSponge();
      field = mimcjs.F;

      xL = field.e(sampleInput.xL_in.toString());
      xR = field.e(sampleInput.xR_in.toString());
      key = field.e(sampleInput.k.toString());
    });

    it('should have the same result as mimc js', async () => {
      const witness = await circuit.calculateLabeledWitness(
        sampleInput,
        sanityCheck,
      );

      const expected = mimcjs.encrypt(xL, xR, key);

      // check resulting root as output
      assert.propertyVal(
        witness,
        'main.xL_out',
        field.toObject(expected.xL).toString(),
      );
      assert.propertyVal(
        witness,
        'main.xR_out',
        field.toObject(expected.xR).toString(),
      );
    });
  });
});
