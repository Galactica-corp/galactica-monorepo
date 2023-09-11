/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert, expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { buildEddsa } from 'circomlibjs';
import { readFileSync } from 'fs';
import hre, { ethers } from 'hardhat';
import { CircuitTestUtils } from 'hardhat-circom';

import { ZkCertStandard } from '../../lib';
import {
  createHolderCommitment,
  getEddsaKeyFromEthSigner,
} from '../../lib/keyManagement';
import { ZKCertificate } from '../../lib/zkCertificate';

use(chaiAsPromised);

describe('Ownership Component', () => {
  let circuit: CircuitTestUtils;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/ownership.json', 'utf8'),
  );

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('ownership');
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('has expected witness values', async () => {
    const witness = await circuit.calculateLabeledWitness(
      sampleInput,
      sanityCheck,
    );
    assert.propertyVal(witness, 'main.ax', sampleInput.ax);
    // check resulting output
    assert.propertyVal(witness, 'main.valid', '1');
  });

  it('has verified the signature successfully', async () => {
    const expected = { valid: 1 };
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.assertOut(witness, expected);
  });

  it('identifies invalid signatures correctly', async () => {
    const fieldsToChange = ['ax', 'ay', 'r8x', 'r8y', 's', 'holderCommitment'];
    for (const field of fieldsToChange) {
      const forgedInput = { ...sampleInput };
      forgedInput[field] += 1;
      await expect(
        circuit.calculateLabeledWitness(forgedInput, sanityCheck),
      ).to.be.rejectedWith('Error: Assert Failed.');
    }
  });

  it('can validate ownership commitments generated in our front-end', async () => {
    const eddsa = await buildEddsa();
    const holder = (await ethers.getSigners())[5];

    const holderEdDSAKey = await getEddsaKeyFromEthSigner(holder);
    const holderCommitment = createHolderCommitment(eddsa, holderEdDSAKey);
    const zkKYC = new ZKCertificate(
      holderCommitment,
      ZkCertStandard.ZkKYC,
      eddsa,
      0,
    );
    const ownershipProof = zkKYC.getOwnershipProofInput(holderEdDSAKey);

    const expected = { valid: 1 };
    const witness = await circuit.calculateWitness(ownershipProof, sanityCheck);
    await circuit.assertOut(witness, expected);
  });
});
