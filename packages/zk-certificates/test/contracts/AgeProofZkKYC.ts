/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';
import chai, { use } from 'chai';

chai.config.includeStack = true;

import { MockKYCRegistry } from '../../typechain-types/contracts/mock/MockKYCRegistry';
import { AgeProofZkKYC } from '../../typechain-types/contracts/AgeProofZkKYC';
import { AgeProofZkKYCVerifier } from '../../typechain-types/contracts/AgeProofZkKYCVerifier';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const snarkjs = require('snarkjs');
const hre = require('hardhat');

import {
  fromDecToHex,
  processProof,
  processPublicSignals,
  fromHexToBytes32,
} from '../../lib/helpers';
import { generateSampleZkKYC, generateZkKYCProofInput } from '../../scripts/generateZKKYCInput';
import { ZKCertificate } from '../../lib/zkCertificate';

const { expect } = chai;

describe('ageProofZkKYC SC', async () => {
  // reset the testing chain so we can perform time related tests
  /* await hre.network.provider.send('hardhat_reset'); */
  let ageProofZkKYC: AgeProofZkKYC;
  let ageProofZkKYCVerifier: AgeProofZkKYCVerifier;
  let mockKYCRegistry: MockKYCRegistry;

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let zkKYC: ZKCertificate;
  let sampleInput: any, circuitWasmPath: string, circuitZkeyPath: string;

  beforeEach(async () => {
    // reset the testing chain so we can perform time related tests
    await hre.network.provider.send('hardhat_reset');

    [deployer, user, randomUser] = await hre.ethers.getSigners();

    // set up KYCRegistry, ZkKYCVerifier, ZkKYC
    const mockKYCRegistryFactory = await ethers.getContractFactory(
      'MockKYCRegistry',
      deployer
    );
    mockKYCRegistry =
      (await mockKYCRegistryFactory.deploy()) as MockKYCRegistry;

    const ageProofZkKYCVerifierFactory = await ethers.getContractFactory(
      'AgeProofZkKYCVerifier',
      deployer
    );
    ageProofZkKYCVerifier =
      (await ageProofZkKYCVerifierFactory.deploy()) as AgeProofZkKYCVerifier;

    const ageProofZkKYCFactory = await ethers.getContractFactory(
      'AgeProofZkKYC',
      deployer
    );
    ageProofZkKYC = (await ageProofZkKYCFactory.deploy(
      deployer.address,
      ageProofZkKYCVerifier.address,
      mockKYCRegistry.address,
      []
    )) as AgeProofZkKYC;
    await ageProofZkKYCVerifier.deployed();

    // inputs to create proof
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(zkKYC, 0, ageProofZkKYC.address);
    const today = new Date(Date.now());
    sampleInput.currentYear = today.getUTCFullYear();
    sampleInput.currentMonth = today.getUTCMonth() + 1;
    sampleInput.currentDay = today.getUTCDate();
    sampleInput.ageThreshold = 18;

    // advance time a bit to set it later in the test
    sampleInput.currentTime += 100;

    // get signer object authorized to use the zkKYC record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    circuitWasmPath = './circuits/build/ageProofZkKYC.wasm';
    circuitZkeyPath = './circuits/build/ageProofZkKYC.zkey';
  });

  it('only owner can change KYCRegistry and Verifier addresses', async () => {
    // random user cannot change the addresses
    await expect(
      ageProofZkKYC.connect(user).setVerifier(user.address)
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(
      ageProofZkKYC.connect(user).setKYCRegistry(user.address)
    ).to.be.revertedWith('Ownable: caller is not the owner');

    //owner can change addresses
    await ageProofZkKYC.connect(deployer).setVerifier(user.address);
    await ageProofZkKYC.connect(deployer).setKYCRegistry(user.address);

    expect(await ageProofZkKYC.verifier()).to.be.equal(user.address);
    expect(await ageProofZkKYC.KYCRegistry()).to.be.equal(user.address);
  });

  it('correct proof can be verified onchain', async () => {
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

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await ageProofZkKYC.connect(user).verifyProof(a, b, c, publicInputs);
  });

  it('incorrect proof failed to be verified', async () => {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    // set the merkle root to the correct one

    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );
    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);

    // switch c, a to get an incorrect proof
    // it doesn't fail on time because the time change remains from the previous test
    await expect(ageProofZkKYC.connect(user).verifyProof(c, b, a, publicInputs))
      .to.be.reverted;
  });

  it('revert if proof output is invalid', async () => {
    let forgedInput = { ...sampleInput };
    // make the zkKYC record expire leading to invalid proof output
    forgedInput.currentTime = forgedInput.expirationDate + 1;

    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      forgedInput,
      circuitWasmPath,
      circuitZkeyPath
    );
    expect(publicSignals[await ageProofZkKYC.INDEX_IS_VALID()]).to.be.equal('0');
    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    // set the merkle root to the correct one

    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );
    // set time to the public time
    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await expect(
      ageProofZkKYC.connect(user).verifyProof(c, b, a, publicInputs)
    ).to.be.revertedWith('the proof output is not valid');
  });

  it('revert if public output merkle root does not match with the one onchain', async () => {
    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    // we don't set the merkle root to the correct one

    // set time to the public time
    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await expect(
      ageProofZkKYC.connect(user).verifyProof(c, b, a, publicInputs)
    ).to.be.revertedWith("the root in the proof doesn't match");
  });

  it('revert if time is too far from current time', async () => {
    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    const pulicTime = parseInt(publicSignals[await ageProofZkKYC.INDEX_CURRENT_TIME()], 10);
    // set the merkle root to the correct one

    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );
    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      pulicTime + 200,
    ]);

    await hre.network.provider.send('evm_mine');
    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await expect(
      ageProofZkKYC.connect(user).verifyProof(c, b, a, publicInputs)
    ).to.be.revertedWith('the current time is incorrect');
  });

  it('unauthorized user cannot use the proof', async () => {
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
    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await expect(
      ageProofZkKYC.connect(randomUser).verifyProof(c, b, a, publicInputs)
    ).to.be.revertedWith(
      'transaction submitter is not authorized to use this proof'
    );
  });

  it('revert if public input for year is incorrect', async () => {
    let forgedInput = { ...sampleInput };
    // make the zkKYC record expire leading to invalid proof output
    forgedInput.currentYear = forgedInput.currentYear + 1;

    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      forgedInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    const pulicTime = parseInt(publicSignals[await ageProofZkKYC.INDEX_CURRENT_TIME()], 10);
    // set the merkle root to the correct one

    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );
    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [pulicTime]);

    await hre.network.provider.send('evm_mine');
    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await expect(
      ageProofZkKYC.connect(user).verifyProof(c, b, a, publicInputs)
    ).to.be.revertedWith('the current year is incorrect');
  });
});
