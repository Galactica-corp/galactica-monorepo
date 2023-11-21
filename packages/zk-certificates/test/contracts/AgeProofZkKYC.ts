/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import hre, { ethers } from 'hardhat';
import { groth16 } from 'snarkjs';

import {
  fromDecToHex,
  processProof,
  processPublicSignals,
  fromHexToBytes32,
} from '../../lib/helpers';
import { ZKCertificate } from '../../lib/zkCertificate';
import {
  generateSampleZkKYC,
  generateZkKYCProofInput,
} from '../../scripts/generateZKKYCInput';
import { AgeProofZkKYC } from '../../typechain-types/contracts/AgeProofZkKYC';
import { AgeProofZkKYCVerifier } from '../../typechain-types/contracts/AgeProofZkKYCVerifier';
import { MockKYCRegistry } from '../../typechain-types/contracts/mock/MockKYCRegistry';

chai.config.includeStack = true;
const { expect } = chai;

describe('ageProofZkKYC SC', () => {
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
      deployer,
    );
    mockKYCRegistry =
      (await mockKYCRegistryFactory.deploy()) as MockKYCRegistry;

    const ageProofZkKYCVerifierFactory = await ethers.getContractFactory(
      'AgeProofZkKYCVerifier',
      deployer,
    );
    ageProofZkKYCVerifier =
      (await ageProofZkKYCVerifierFactory.deploy()) as AgeProofZkKYCVerifier;

    const ageProofZkKYCFactory = await ethers.getContractFactory(
      'AgeProofZkKYC',
      deployer,
    );
    ageProofZkKYC = (await ageProofZkKYCFactory.deploy(
      deployer.address,
      ageProofZkKYCVerifier.address,
      mockKYCRegistry.address,
      [],
    )) as AgeProofZkKYC;
    await ageProofZkKYCVerifier.deployed();

    // inputs to create proof
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(
      zkKYC,
      0,
      ageProofZkKYC.address,
    );
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
      ageProofZkKYC.connect(user).setVerifier(user.address),
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(
      ageProofZkKYC.connect(user).setKYCRegistry(user.address),
    ).to.be.revertedWith('Ownable: caller is not the owner');

    // owner can change addresses
    await ageProofZkKYC.connect(deployer).setVerifier(user.address);
    await ageProofZkKYC.connect(deployer).setKYCRegistry(user.address);

    expect(await ageProofZkKYC.verifier()).to.be.equal(user.address);
    expect(await ageProofZkKYC.KYCRegistry()).to.be.equal(user.address);
  });

  it('correct proof can be verified onchain', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    const publicTime = parseInt(
      publicSignals[await ageProofZkKYC.INDEX_CURRENT_TIME()],
      10,
    );
    // set the merkle root to the correct one
    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await ageProofZkKYC.connect(user).verifyProof(piA, piB, piC, publicInputs);
  });

  it('incorrect proof failed to be verified', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    // set the merkle root to the correct one

    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);

    // switch c, a to get an incorrect proof
    // it doesn't fail on time because the time change remains from the previous test
    await expect(
      ageProofZkKYC.connect(user).verifyProof(piC, piB, piA, publicInputs),
    ).to.be.reverted;
  });

  it('revert if proof output is invalid', async () => {
    const forgedInput = { ...sampleInput };
    // make the zkKYC record expire leading to invalid proof output
    forgedInput.currentTime = Number(forgedInput.expirationDate) + 1;

    const { proof, publicSignals } = await groth16.fullProve(
      forgedInput,
      circuitWasmPath,
      circuitZkeyPath,
    );
    expect(publicSignals[await ageProofZkKYC.INDEX_IS_VALID()]).to.be.equal(
      '0',
    );
    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    // set the merkle root to the correct one

    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    // set time to the public time
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      ageProofZkKYC.connect(user).verifyProof(piC, piB, piA, publicInputs),
    ).to.be.revertedWith('the proof output is not valid');
  });

  it('revert if public output merkle root does not match with the one onchain', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    // we don't set the merkle root to the correct one

    // set time to the public time
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      ageProofZkKYC.connect(user).verifyProof(piC, piB, piA, publicInputs),
    ).to.be.revertedWith("the root in the proof doesn't match");
  });

  it('revert if time is too far from current time', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    const publicTime = parseInt(
      publicSignals[await ageProofZkKYC.INDEX_CURRENT_TIME()],
      10,
    );
    // set the merkle root to the correct one

    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      publicTime + 200 + 30 * 60,
    ]);

    await hre.network.provider.send('evm_mine');
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      ageProofZkKYC.connect(user).verifyProof(piC, piB, piA, publicInputs),
    ).to.be.revertedWith('the current time is incorrect');
  });

  it('unauthorized user cannot use the proof', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    const publicTime = parseInt(
      publicSignals[await ageProofZkKYC.INDEX_CURRENT_TIME()],
      10,
    );
    // set the merkle root to the correct one
    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      ageProofZkKYC
        .connect(randomUser)
        .verifyProof(piC, piB, piA, publicInputs),
    ).to.be.revertedWith(
      'transaction submitter is not authorized to use this proof',
    );
  });

  it('revert if public input for year is incorrect', async () => {
    const forgedInput = { ...sampleInput };
    // make the zkKYC record expire leading to invalid proof output
    forgedInput.currentYear += 1;

    const { proof, publicSignals } = await groth16.fullProve(
      forgedInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[await ageProofZkKYC.INDEX_ROOT()];
    const pulicTime = parseInt(
      publicSignals[await ageProofZkKYC.INDEX_CURRENT_TIME()],
      10,
    );
    // set the merkle root to the correct one

    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [pulicTime]);

    await hre.network.provider.send('evm_mine');
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      ageProofZkKYC.connect(user).verifyProof(piC, piB, piA, publicInputs),
    ).to.be.revertedWith('the current year is incorrect');
  });
});
