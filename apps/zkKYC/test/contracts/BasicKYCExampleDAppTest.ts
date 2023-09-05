/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
const snarkjs = require('snarkjs');
const hre = require('hardhat');

import chai from 'chai';
chai.config.includeStack = true;
const { expect } = chai;

import { MockKYCRegistry } from '../../typechain-types/contracts/mock/MockKYCRegistry';
import { BasicKYCExampleDApp } from '../../typechain-types/contracts/BasicKYCExampleDApp';
import { VerificationSBT } from '../../typechain-types/contracts/VerificationSBT';
import { ZkKYC } from '../../typechain-types/contracts/ZkKYC';
import { ZkKYCVerifier } from '../../typechain-types/contracts/ZkKYCVerifier';
import {
  fromDecToHex,
  processProof,
  processPublicSignals,
  fromHexToBytes32,
} from '../../lib/helpers';
import { generateSampleZkKYC, generateZkKYCProofInput } from '../../scripts/generateZKKYCInput';
import { ZKCertificate } from '../../lib/zkCertificate';


describe('BasicKYCExampleDApp', async () => {
  // reset the testing chain so we can perform time related tests
  /* await hre.network.provider.send('hardhat_reset'); */
  let zkKycSC: ZkKYC;
  let zkKYCVerifier: ZkKYCVerifier;
  let mockKYCRegistry: MockKYCRegistry;
  let verificationSBT: VerificationSBT;
  let basicExampleDApp: BasicKYCExampleDApp;

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let zkKYC: ZKCertificate;
  let sampleInput: any, circuitWasmPath: string, circuitZkeyPath: string;

  beforeEach(async () => {
    // TODO: use fixture instead
    // reset the testing chain so we can perform time related tests
    await hre.network.provider.send('hardhat_reset');

    [deployer, user] = await hre.ethers.getSigners();

    // set up KYCRegistry, ZkKYCVerifier, ZkKYC
    const mockKYCRegistryFactory = await ethers.getContractFactory(
      'MockKYCRegistry',
      deployer
    );
    mockKYCRegistry =
      await mockKYCRegistryFactory.deploy() as MockKYCRegistry;

    const zkKYCVerifierFactory = await ethers.getContractFactory(
      'ZkKYCVerifier',
      deployer
    );
    zkKYCVerifier =
      await zkKYCVerifierFactory.deploy() as ZkKYCVerifier;

    const zkKYCFactory = await ethers.getContractFactory(
      'ZkKYC',
      deployer
    );
    zkKycSC = (await zkKYCFactory.deploy(
      deployer.address,
      zkKYCVerifier.address,
      mockKYCRegistry.address,
      []
    )) as ZkKYC;
    await zkKYCVerifier.deployed();

    const verificationSBTFactory = await ethers.getContractFactory(
      'VerificationSBT',
      deployer
    );
    verificationSBT = await verificationSBTFactory.deploy() as VerificationSBT;


    const repeatableZKPTestFactory = await ethers.getContractFactory(
      'BasicKYCExampleDApp',
      deployer
    );
    basicExampleDApp = await repeatableZKPTestFactory.deploy(
      verificationSBT.address,
      zkKycSC.address,
    ) as BasicKYCExampleDApp;

    // inputs to create proof
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(zkKYC, 0, basicExampleDApp.address);
    sampleInput.dAppAddress = basicExampleDApp.address;

    // advance time a bit to set it later in the test
    sampleInput.currentTime += 100;

    // get signer object authorized to use the zkKYC record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    circuitWasmPath = './circuits/build/zkKYC.wasm';
    circuitZkeyPath = './circuits/build/zkKYC.zkey';
  });

  it('should issue VerificationSBT on correct proof and refuse to re-register before expiration', async () => {
    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    const publicRoot = publicSignals[await zkKycSC.INDEX_ROOT()];
    const publicTime = parseInt(publicSignals[await zkKycSC.INDEX_CURRENT_TIME()], 10);
    // set the merkle root to the correct one
    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await basicExampleDApp.connect(user).registerKYC(a, b, c, publicInputs);

    expect(await verificationSBT.isVerificationSBTValid(user.address, basicExampleDApp.address)).to.be.true;

    expect(basicExampleDApp.connect(user).registerKYC(a, b, c, publicInputs)).to.be.revertedWith("user already has a verification SBT");

    // wait until verification SBT expires to renew it
    const sbt = await verificationSBT.getVerificationSBTInfo(user.address, basicExampleDApp.address);
    let laterProofInput = { ...sampleInput };
    laterProofInput.currentTime = sbt.expirationTime.toNumber() + 1;
    await hre.network.provider.send('evm_setNextBlockTimestamp', [laterProofInput.currentTime]);
    await hre.network.provider.send('evm_mine');

    expect(await verificationSBT.isVerificationSBTValid(user.address, basicExampleDApp.address)).to.be.false;

    let laterProof = await snarkjs.groth16.fullProve(
      laterProofInput,
      circuitWasmPath,
      circuitZkeyPath
    );
    [a, b, c] = processProof(laterProof.proof);
    publicInputs = processPublicSignals(laterProof.publicSignals);
    await basicExampleDApp.connect(user).registerKYC(a, b, c, laterProof.publicSignals);

    expect(await verificationSBT.isVerificationSBTValid(user.address, basicExampleDApp.address)).to.be.true;
  });

  it('should catch incorrect proof', async () => {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    const publicRoot = publicSignals[await zkKycSC.INDEX_ROOT()];
    // set the merkle root to the correct one

    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );
    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);

    // switch c, a to get an incorrect proof
    // it doesn't fail on time because the time change remains from the previous test
    await expect(basicExampleDApp.connect(user).registerKYC(c, b, a, publicInputs))
      .to.be.reverted;
  });
});
