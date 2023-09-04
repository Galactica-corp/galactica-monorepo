/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';
import chai, { use } from 'chai';

chai.config.includeStack = true;

import { MockKYCRegistry } from '../../typechain-types/contracts/mock/MockKYCRegistry';
import { AgeProofZkKYC } from '../../typechain-types/contracts/AgeProofZkKYC';
import { MockGalacticaInstitution } from '../../typechain-types/contracts/mock/MockGalacticaInstitution';
import { ExampleMockDAppVerifier } from '../../typechain-types/contracts/ExampleMockDAppVerifier';
import { MockDApp } from '../../typechain-types/contracts/mock/MockDApp';
import { VerificationSBT } from '../../typechain-types/contracts/VerificationSBT';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { generateZkKYCProofInput, generateSampleZkKYC } from '../../scripts/generateZKKYCInput';
import { reconstructShamirSecret } from '../../lib/shamirTools';

const snarkjs = require('snarkjs');
const hre = require('hardhat');
import {
  fromDecToHex,
  processProof,
  processPublicSignals,
  fromHexToBytes32,
} from '../../lib/helpers';
import { decryptFraudInvestigationData } from '../../lib/SBTData';
import { getEddsaKeyFromEthSigner } from '../../lib/keyManagement';
import { ZKCertificate } from '../../lib/zkCertificate';
import { queryVerificationSBTs } from '../../lib/queryVerificationSBT';

import { buildEddsa } from 'circomlibjs';
import { BigNumber } from 'ethers';

const { expect } = chai;

describe('Verification SBT Smart contract', async () => {
  let ageProofZkKYC: AgeProofZkKYC;
  let exampleMockDAppVerifier: ExampleMockDAppVerifier;
  let mockKYCRegistry: MockKYCRegistry;
  let mockGalacticaInstitutions: MockGalacticaInstitution[];
  const amountInstitutions = 3;
  let mockDApp: MockDApp;
  let verificationSBT: VerificationSBT;
  let token1, token2;

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let encryptionAccount: SignerWithAddress;
  let institutions: SignerWithAddress[] = [];
  let KYCProvider: SignerWithAddress;
  let zkKYC: ZKCertificate;
  let sampleInput: any;
  let circuitWasmPath: string;
  let circuitZkeyPath: string;

  beforeEach(async () => {
    // reset the testing chain so we can perform time related tests
    await hre.network.provider.send('hardhat_reset');

    [deployer, user, encryptionAccount, KYCProvider] =
      await hre.ethers.getSigners();
    for (let i = 0; i < amountInstitutions; i++) {
      institutions.push((await ethers.getSigners())[4 + i]);
    }

    // set up KYCRegistry, ZkKYCVerifier, ZkKYC
    const mockKYCRegistryFactory = await ethers.getContractFactory(
      'MockKYCRegistry',
      deployer
    );
    mockKYCRegistry =
      (await mockKYCRegistryFactory.deploy()) as MockKYCRegistry;

    const mockGalacticaInstitutionFactory = await ethers.getContractFactory(
      'MockGalacticaInstitution',
      deployer
    );
    mockGalacticaInstitutions = [];
    for (let i = 0; i < amountInstitutions; i++) {
      mockGalacticaInstitutions.push(
        (await mockGalacticaInstitutionFactory.deploy()) as MockGalacticaInstitution
      );
    }

    const exampleMockDAppVerifierFactory = await ethers.getContractFactory(
      'ExampleMockDAppVerifier',
      deployer
    );
    exampleMockDAppVerifier =
      (await exampleMockDAppVerifierFactory.deploy()) as ExampleMockDAppVerifier;

    const ageProofZkKYCFactory = await ethers.getContractFactory(
      'AgeProofZkKYC',
      deployer
    );
    ageProofZkKYC = (await ageProofZkKYCFactory.deploy(
      deployer.address,
      exampleMockDAppVerifier.address,
      mockKYCRegistry.address,
      mockGalacticaInstitutions.map((inst) => inst.address)
    )) as AgeProofZkKYC;

    const verificationSBTFactory = await ethers.getContractFactory(
      'VerificationSBT',
      deployer
    );
    verificationSBT =
      (await verificationSBTFactory.deploy()) as VerificationSBT;

    const mockDAppFactory = await ethers.getContractFactory(
      'MockDApp',
      deployer
    );
    mockDApp = (await mockDAppFactory.deploy(
      verificationSBT.address,
      ageProofZkKYC.address
    )) as MockDApp;

    const mockTokenFactory = await ethers.getContractFactory(
      'MockToken',
      deployer
    );

    token1 = await mockTokenFactory.deploy(mockDApp.address);
    token2 = await mockTokenFactory.deploy(mockDApp.address);

    await mockDApp.setToken1(token1.address);
    await mockDApp.setToken2(token2.address);

    // inputs to create proof
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(zkKYC, amountInstitutions, mockDApp.address);
    const today = new Date(Date.now());
    sampleInput.currentYear = today.getUTCFullYear();
    sampleInput.currentMonth = today.getUTCMonth() + 1;
    sampleInput.currentDay = today.getUTCDate();
    sampleInput.ageThreshold = 18;

    // advance time a bit to set it later in the test
    sampleInput.currentTime += 100;

    // get signer object authorized to use the zkKYC record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    // get signer object authorized to use the zkKYC record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    circuitWasmPath = './circuits/build/exampleMockDApp.wasm';
    circuitZkeyPath = './circuits/build/exampleMockDApp.zkey';
  });

  it('if the proof is correct the verification SBT is minted', async () => {
    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    const publicTime = parseInt(publicSignals[await ageProofZkKYC.INDEX_CURRENT_TIME()], 10);
    // set the merkle root to the correct one
    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );

    // set the galactica institution pub key
    // set the institution pub keys
    for (let i = 0; i < amountInstitutions; i++) {
      const galacticaInstitutionPubKey: [BigNumber, BigNumber] = [
        publicSignals[await ageProofZkKYC.START_INDEX_INVESTIGATION_INSTITUTIONS() + 2 * i],
        publicSignals[await ageProofZkKYC.START_INDEX_INVESTIGATION_INSTITUTIONS() + 2 * i + 1]
      ];
      await mockGalacticaInstitutions[i].setInstitutionPubkey(
        galacticaInstitutionPubKey
      );
    }

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await mockDApp.connect(user).airdropToken(1, a, b, c, publicInputs);

    // check that the verification SBT is created
    expect(
      await verificationSBT.isVerificationSBTValid(
        user.address,
        mockDApp.address
      )
    ).to.be.equal(true);

    // data is stored for the correct humanID
    expect(
      await mockDApp.hasReceivedToken1(
        fromHexToBytes32(fromDecToHex(sampleInput.humanID))
      )
    ).to.be.equal(true);

    // check the content of the verification SBT
    const verificationSBTInfo = await verificationSBT.getVerificationSBTInfo(
      user.address,
      mockDApp.address
    );
    expect(verificationSBTInfo.dApp).to.be.equal(mockDApp.address);
    expect(verificationSBTInfo.verifierWrapper).to.be.equal(
      ageProofZkKYC.address
    );

    // check that the verificationSBT can be used to receive the second token without proof
    await mockDApp.connect(user).airdropToken(
      2,
      [0, 0],
      [
        [0, 0],
        [0, 0],
      ],
      [0, 0],
      publicInputs
    );
    expect(
      await mockDApp.hasReceivedToken2(
        fromHexToBytes32(fromDecToHex(sampleInput.humanID))
      )
    ).to.be.equal(true);

    // test decryption
    const userPriv = BigInt(
      await getEddsaKeyFromEthSigner(encryptionAccount)
    ).toString();

    const eddsa = await buildEddsa();
    const userPub = eddsa.prv2pub(userPriv);

    // let all institutions decrypt their shamir secret sharing part
    let decryptedData: any[][] = [];
    for (let i = 0; i < amountInstitutions; i++) {
      const galaInstitutionPriv = BigInt(
        await getEddsaKeyFromEthSigner(institutions[i])
      ).toString();

      decryptedData[i] = await decryptFraudInvestigationData(
        galaInstitutionPriv,
        userPub,
        [verificationSBTInfo.encryptedData[2 * i], verificationSBTInfo.encryptedData[2 * i + 1]]
      );
    }

    // test if the first two investigation institutions can decrypt the data (2 of 3 shamir secret sharing)
    const reconstructedSecret = reconstructShamirSecret(eddsa.F, 2, [
      [1, decryptedData[0][0]],
      [2, decryptedData[1][0]]
    ]);
    expect(reconstructedSecret, "Fraud investigation should be able to reconstruct the secret").to.be.equal(zkKYC.leafHash);

    // check that the verification SBT can be found by the frontend
    const loggedSBTs = await queryVerificationSBTs(verificationSBT.address, user.address);
    expect(loggedSBTs.has(mockDApp.address)).to.be.true;
    expect(loggedSBTs.get(mockDApp.address)!.length).to.be.equal(1);
  });

  it('should revert on incorrect proof', async () => {
    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    // change the proof to make it incorrect
    proof.pi_a[0] = proof.pi_a[0] + "1";

    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    const publicTime = parseInt(publicSignals[await ageProofZkKYC.INDEX_CURRENT_TIME()], 10);
    // set the merkle root to the correct one
    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);

    let tx = mockDApp.connect(user).airdropToken(1, a, b, c, publicInputs);

    await expect(tx).to.be.rejected;
  });
});
