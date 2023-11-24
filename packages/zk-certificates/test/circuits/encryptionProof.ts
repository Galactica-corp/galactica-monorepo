/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert } from 'chai';
import { Eddsa, buildEddsa } from 'circomlibjs';
import { readFileSync } from 'fs';
import hre, { ethers } from 'hardhat';
import { CircuitTestUtils } from 'hardhat-circom';

import {
  getEddsaKeyFromEthSigner,
  generateEcdhSharedKey,
  formatPrivKeyForBabyJub,
} from '../../lib/keyManagement';
import { buildMimcSponge } from '../../lib/mimcEncrypt';

describe('Encryption Proof', () => {
  let circuit: CircuitTestUtils;
  let eddsa: Eddsa;
  let mimcjs: any;

  const sampleInput = JSON.parse(
    readFileSync('./circuits/input/encryptionProof.json', 'utf8'),
  );

  const sanityCheck = true;

  before(async () => {
    circuit = await hre.circuitTest.setup('encryptionProof');
    eddsa = await buildEddsa();
    mimcjs = await buildMimcSponge();
  });

  it('produces a witness with valid constraints', async () => {
    const witness = await circuit.calculateWitness(sampleInput, sanityCheck);
    await circuit.checkConstraints(witness);
  });

  it('generates unique shared ECDH key for sender and receiver', async () => {
    const [sender, receiver] = await ethers.getSigners();
    const message = ['42', '69'];

    const senderPriv = await getEddsaKeyFromEthSigner(sender);
    const receiverPriv = await getEddsaKeyFromEthSigner(receiver);

    const receiverPub = eddsa.prv2pub(receiverPriv);

    const sharedKey = generateEcdhSharedKey(senderPriv, receiverPub, eddsa);

    const circuitInputs = {
      senderPrivKey: formatPrivKeyForBabyJub(senderPriv, eddsa),
      receiverPubKey: receiverPub.map((pubKey: any) =>
        eddsa.poseidon.F.toObject(pubKey).toString(),
      ),
      // eslint-disable-next-line id-denylist
      msg: message,
    };
    const witness = await circuit.calculateLabeledWitness(
      circuitInputs,
      sanityCheck,
    );

    const expectedResult = mimcjs.encrypt(message[0], message[1], sharedKey[0]);

    assert.propertyVal(
      witness,
      'main.encryptedMsg[0]',
      eddsa.poseidon.F.toObject(expectedResult.xL).toString(),
    );
    assert.propertyVal(
      witness,
      'main.encryptedMsg[1]',
      eddsa.poseidon.F.toObject(expectedResult.xR).toString(),
    );
  });
});
