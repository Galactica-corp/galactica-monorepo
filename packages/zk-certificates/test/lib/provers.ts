/* Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import type { Eddsa } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';
import { ethers } from 'hardhat';
import { groth16 } from 'snarkjs';

import { Prover } from '../../lib/provers';
import type { ProverData, ProverLink, GenZkProofParams } from '../../lib/proofs';
import { EddsaPrivateKey, KnownZkCertStandard } from '@galactica-net/galactica-types';
import { ZkCertificate } from '../../lib/zkCertificate';
import { MerkleTree } from '../../lib/merkleTree';
import { getEddsaKeyFromEthSigner } from '../../lib/keyManagement';
import { generateSampleZkKYC, generateZkKYCProofInput } from '../../scripts/dev/generateZkKYCInput';

import exampleMockDAppVKey from '../../../galactica-dapp/public/provers/exampleMockDApp.vkey.json';
import proverFile from '../../../galactica-dapp/public/provers/exampleMockDApp.json';
import { ZkKYCAgeCitizenshipProofInput } from '@galactica-net/snap-api';

const proverData = proverFile as ProverData;

describe('Prover', () => {
  let eddsa: Eddsa;
  let zkKYC: ZkCertificate;
  let holderEddsaKey: EddsaPrivateKey;
  let merkleProof: any;
  let merkleRoot: string;
  let user: SignerWithAddress;

  before(async () => {
    eddsa = await buildEddsa();
  });

  beforeEach(async () => {
    zkKYC = await generateSampleZkKYC();
    // Get signers and holder key
    const signers = await ethers.getSigners();
    user = signers[0];
    holderEddsaKey = await getEddsaKeyFromEthSigner(user);

    // Create merkle tree and proof
    const merkleTree = new MerkleTree(32, eddsa.poseidon);
    merkleTree.insertLeaves([zkKYC.leafHash]);
    merkleRoot = merkleTree.root;
    merkleProof = merkleTree.createProof(zkKYC.leafHash);
  });

  describe('Prover.new()', () => {
    it('should create Prover instance from ProverData', async () => {
      const prover = await Prover.new(proverData);
      expect(prover).to.be.instanceOf(Prover);
    });

    it('should throw error when ProverLink is provided without URL', async () => {
      const invalidProverLink = {
        hash: 'test-hash',
      } as ProverLink;

      await expect(Prover.new(invalidProverLink)).to.be.rejectedWith(
        'ProverLink does not contain a URL.'
      );
    });

    it('should handle ProverLink with empty URL', async () => {
      const invalidProverLink = {
        hash: 'test-hash',
      } as ProverLink;

      await expect(Prover.new(invalidProverLink)).to.be.rejectedWith(
        'ProverLink does not contain a URL.'
      );
    });
  });

  describe('generateProof()', () => {

    let params: GenZkProofParams<ZkKYCAgeCitizenshipProofInput>;

    beforeEach(async () => {
      // Generate proper zkKYC proof input using existing helper
      const zkKYCInput = await generateZkKYCProofInput(
        zkKYC,
        3, // no institutions
        '0x0000000000000000000000000000000000000000', // dApp address
        32, // merkle tree depth
        user, // holder
        user, // user
      );

      params = {
        input: {
          ...zkKYCInput,
          currentTime: 1676033833,
          currentYear: '2023',
          currentMonth: '2',
          currentDay: '10',
          ageThreshold: '18',
          countryExclusionList: [],
        },
        requirements: {
          zkCertStandard: KnownZkCertStandard.ZkKYC,
          registryAddress: '0x0000000000000000000000000000000000000000',
        },
        prover: proverData,
        userAddress: await user.getAddress(),
        description: 'zkKYC proof test',
        publicInputDescriptions: ['isValid', 'root', 'currentTime'],
        zkInputRequiresPrivKey: false,
      };
    });

    it('should generate a valid proof for zkKYC circuit', async () => {
      const prover = await Prover.new(proverData);

      const proof = await prover.generateProof(
        params,
        zkKYC,
        holderEddsaKey,
        merkleProof
      );

      expect(proof).to.have.property('proof');
      expect(proof).to.have.property('publicSignals');
      expect(proof.proof).to.have.property('pi_a');
      expect(proof.proof).to.have.property('pi_b');
      expect(proof.proof).to.have.property('pi_c');
      expect(proof.publicSignals).to.be.an('array');
      expect(proof.publicSignals.length).to.be.greaterThan(0);

      // Verify proof structure
      expect(proof.proof.pi_a).to.be.an('array').with.length(3);
      expect(proof.proof.pi_b).to.be.an('array').with.length(3);
      expect(proof.proof.pi_b[0]).to.be.an('array').with.length(2);
      expect(proof.proof.pi_b[1]).to.be.an('array').with.length(2);
      expect(proof.proof.pi_c).to.be.an('array').with.length(3);
      expect(proof.proof).to.have.property('protocol');
      expect(proof.proof).to.have.property('curve');

      expect(proof).to.have.property('proof');
      expect(proof).to.have.property('publicSignals');

      const isValid = await groth16.verify(exampleMockDAppVKey, proof.publicSignals, proof.proof);
      expect(isValid).to.be.true;
    });
  });
});
