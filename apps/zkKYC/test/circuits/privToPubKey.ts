/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert, expect } from 'chai';
import { readFileSync } from 'fs';
import hre from 'hardhat';
import { CircuitTestUtils } from 'hardhat-circom';
import { buildEddsa } from "circomlibjs";
import { ethers } from "hardhat";

import { getEddsaKeyFromEthSigner, formatPrivKeyForBabyJub } from "../../lib/keyManagement";

describe('Private to public key derivation', () => {
  let circuit: CircuitTestUtils;
  let eddsa: any;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/privToPubKey.json', 'utf8')
  );

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('privToPubKey');
    eddsa = await buildEddsa();
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('computes expected pubKey', async () => {
    const [ alice ] = await ethers.getSigners();

    const privKey = await getEddsaKeyFromEthSigner(alice);    
    const privKeyConverted = BigInt(privKey).toString();
    const privKeyField = formatPrivKeyForBabyJub(privKeyConverted, eddsa);
  
    const pubKey = eddsa.prv2pub(privKeyConverted);
  
    const witness = await circuit.calculateLabeledWitness(
      {"privKey": privKeyField},
      sanityCheck
    );

    assert.propertyVal(witness, 'main.privKey', privKeyField.toString());

    // check resulting output
    for(let i in [0, 1]){
      assert.propertyVal(witness, `main.pubKey[${i}]`,
       eddsa.poseidon.F.toObject(pubKey[i]).toString());
    }
  });
});
