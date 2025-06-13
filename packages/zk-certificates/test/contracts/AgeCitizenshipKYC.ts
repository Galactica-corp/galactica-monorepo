/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import chai from 'chai';
import { buildPoseidon } from 'circomlibjs';
import hre, { ethers } from 'hardhat';
import { groth16 } from 'snarkjs';

import type { Poseidon } from '../../lib';
import {
  fromDecToHex,
  fromHexToBytes32,
  hashStringToFieldNumber,
  processProof,
  processPublicSignals,
} from '../../lib/helpers';
import {
  generateSampleZkKYC,
  generateZkKYCProofInput,
} from '../../scripts/dev/generateZkKYCInput';
import type { KYCRequirementsDemoDApp } from '../../typechain-types/contracts/dapps/KYCRequirementsDemoDApp';
import type { GuardianRegistry } from '../../typechain-types/contracts/GuardianRegistry';
import type { MockZkCertificateRegistry } from '../../typechain-types/contracts/mock/MockZkCertificateRegistry';
import type { VerificationSBT } from '../../typechain-types/contracts/SBT_related/VerificationSBT';
import type { AgeCitizenshipKYC } from '../../typechain-types/contracts/verifierWrappers/AgeCitizenshipKYC';
import type { AgeCitizenshipKYCVerifier } from '../../typechain-types/contracts/zkpVerifiers/AgeCitizenshipKYCVerifier';

chai.config.includeStack = true;
const { expect } = chai;

describe('AgeCitizenshipKYCVerifier SC', () => {
  // constants
  const circuitWasmPath = './circuits/build/ageCitizenshipKYC.wasm';
  const circuitZkeyPath = './circuits/build/ageCitizenshipKYC.zkey';

  /**
   * Deploy fixtures to work with the same setup in an efficient way.
   * @returns Fixtures.
   */
  async function deploy() {
    const [deployer, user, randomUser] = await hre.ethers.getSigners();

    const poseidon = (await buildPoseidon()) as Poseidon;

    const countryExclusionList = [
      '1',
      hashStringToFieldNumber('IRN', poseidon),
      hashStringToFieldNumber('USA', poseidon),
    ].concat(Array(17).fill('0'));

    const mockZkCertificateRegistry = (await ethers.deployContract(
      'MockZkCertificateRegistry',
    )) as MockZkCertificateRegistry;

    const ageCitizenshipKYCVerifier = (await ethers.deployContract(
      'AgeCitizenshipKYCVerifier',
    )) as AgeCitizenshipKYCVerifier;

    const ageCitizenshipKYC = (await ethers.deployContract(
      'AgeCitizenshipKYC',
      [
        deployer.address,
        await ageCitizenshipKYCVerifier.getAddress(),
        await mockZkCertificateRegistry.getAddress(),
        countryExclusionList,
        [],
        18,
      ],
    )) as AgeCitizenshipKYC;
    await ageCitizenshipKYCVerifier.waitForDeployment();

    const kycRequirementsDemoDApp = (await ethers.deployContract(
      'KYCRequirementsDemoDApp',
      [
        await ageCitizenshipKYC.getAddress(),
        'test URI',
        'VerificationSBT',
        'VerificationSBT',
      ],
    )) as KYCRequirementsDemoDApp;

    const verificationSBT = (await ethers.getContractAt(
      'VerificationSBT',
      await kycRequirementsDemoDApp.sbt(),
    )) as VerificationSBT;

    const guardianRegistry = (await ethers.deployContract('GuardianRegistry', [
      '',
    ])) as GuardianRegistry;
    await mockZkCertificateRegistry.setGuardianRegistry(
      await guardianRegistry.getAddress(),
    );

    // default zkKYC
    const zkKYC = await generateSampleZkKYC();

    // Assuming zkKYC is your sample ZkCertificate
    const { providerData } = zkKYC;
    await guardianRegistry.grantGuardianRole(
      deployer.address,
      [providerData.ax, providerData.ay],
      '',
    );

    // default inputs to create proof
    const sampleInput = await generateZkKYCProofInput(
      zkKYC,
      0,
      await kycRequirementsDemoDApp.getAddress(),
    );
    const today = new Date(Date.now());
    sampleInput.currentYear = today.getUTCFullYear();
    sampleInput.currentMonth = today.getUTCMonth() + 1;
    sampleInput.currentDay = today.getUTCDate();
    sampleInput.ageThreshold = 18;
    // advance time a bit to set it later in the test
    sampleInput.currentTime += 100;
    // add countries to the sanction list
    sampleInput.countryExclusionList = countryExclusionList;

    // compute default proof
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );
    const publicRoot =
      publicSignals[Number(await ageCitizenshipKYC.INDEX_ROOT())];

    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    const publicTime = parseInt(
      publicSignals[Number(await ageCitizenshipKYC.INDEX_CURRENT_TIME())],
      10,
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);
    const publicInputs = processPublicSignals(publicSignals);

    return {
      acc: {
        deployer,
        user,
        randomUser,
      },
      sc: {
        ageCitizenshipKYC,
        ageCitizenshipKYCVerifier,
        mockZkCertificateRegistry,
        verificationSBT,
        kycRequirementsDemoDApp,
        guardianRegistry, // Add this to the returned object
      },
      poseidon,
      zkKYC,
      sampleInput,
      proof: {
        piA,
        piB,
        piC,
        publicInputs,
      },
    };
  }

  it('only owner can change KYCRegistry and Verifier addresses', async () => {
    const { acc, sc } = await loadFixture(deploy);

    // random user cannot change the addresses
    await expect(
      sc.ageCitizenshipKYC.connect(acc.user).setVerifier(acc.user.address),
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(
      sc.ageCitizenshipKYC.connect(acc.user).setKYCRegistry(acc.user.address),
    ).to.be.revertedWith('Ownable: caller is not the owner');

    // owner can change addresses
    await sc.ageCitizenshipKYC
      .connect(acc.deployer)
      .setVerifier(acc.user.address);
    await sc.ageCitizenshipKYC
      .connect(acc.deployer)
      .setKYCRegistry(acc.user.address);

    expect(await sc.ageCitizenshipKYC.verifier()).to.be.equal(acc.user.address);
    expect(await sc.ageCitizenshipKYC.KYCRegistry()).to.be.equal(
      acc.user.address,
    );
  });

  it('correct proof can be verified onchain', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    await sc.ageCitizenshipKYC
      .connect(acc.user)
      .verifyProof(proof.piA, proof.piB, proof.piC, proof.publicInputs);
  });

  it('proof with older but still valid merkle root can still be verified', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    // add a new merkle root
    await sc.mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex('0x11')),
    );

    await sc.ageCitizenshipKYC
      .connect(acc.user)
      .verifyProof(proof.piA, proof.piB, proof.piC, proof.publicInputs);
  });

  it('revert for proof with old merkle root', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    // add a new merkle root
    await sc.mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex('0x11')),
    );

    // increase the merkleRootValidIndex
    await sc.mockZkCertificateRegistry.setMerkleRootValidIndex(2);

    await expect(
      sc.ageCitizenshipKYC
        .connect(acc.user)
        .verifyProof(proof.piA, proof.piB, proof.piC, proof.publicInputs),
    ).to.be.revertedWith('invalid merkle root');
  });

  it('incorrect proof failed to be verified', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    // switch c, a to get an incorrect proof
    // it doesn't fail on time because the time change remains from the previous test
    await expect(
      sc.ageCitizenshipKYC
        .connect(acc.user)
        .verifyProof(proof.piC, proof.piB, proof.piA, proof.publicInputs),
    ).to.be.reverted;
  });

  it('revert if proof output is invalid', async () => {
    const { acc, sc, sampleInput } = await loadFixture(deploy);

    const forgedInput = { ...sampleInput };
    // make the zkKYC record expire leading to invalid proof output
    forgedInput.currentTime = Number(forgedInput.expirationDate) + 1;

    const { proof, publicSignals } = await groth16.fullProve(
      forgedInput,
      circuitWasmPath,
      circuitZkeyPath,
    );
    expect(
      publicSignals[Number(await sc.ageCitizenshipKYC.INDEX_IS_VALID())],
    ).to.be.equal('0');
    const publicRoot =
      publicSignals[Number(await sc.ageCitizenshipKYC.INDEX_ROOT())];
    // set the merkle root to the correct one

    await sc.mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    // set time to the public time
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      sc.ageCitizenshipKYC
        .connect(acc.user)
        .verifyProof(piA, piB, piC, publicInputs),
    ).to.be.revertedWith('the proof output is not valid');
  });

  it('revert if public output merkle root does not match with the one onchain', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    const fakeProof = JSON.parse(JSON.stringify(proof)); // deep copy
    fakeProof.publicInputs[Number(await sc.ageCitizenshipKYC.INDEX_ROOT())] =
      '0x11';

    await expect(
      sc.ageCitizenshipKYC
        .connect(acc.user)
        .verifyProof(
          fakeProof.piA,
          fakeProof.piB,
          fakeProof.piC,
          fakeProof.publicInputs,
        ),
    ).to.be.revertedWith('invalid merkle root');
  });

  it('revert if time is too far from current time', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    const publicTime = parseInt(
      proof.publicInputs[
      Number(await sc.ageCitizenshipKYC.INDEX_CURRENT_TIME())
      ],
      16,
    );
    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      publicTime + 200 + 30 * 60,
    ]);

    await hre.network.provider.send('evm_mine');
    await expect(
      sc.ageCitizenshipKYC
        .connect(acc.user)
        .verifyProof(proof.piA, proof.piB, proof.piC, proof.publicInputs),
    ).to.be.revertedWith('the current time is incorrect');
  });

  it('unauthorized user cannot use the proof', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    await expect(
      sc.ageCitizenshipKYC
        .connect(acc.randomUser)
        .verifyProof(proof.piA, proof.piB, proof.piC, proof.publicInputs),
    ).to.be.revertedWith(
      'transaction submitter is not authorized to use this proof',
    );
  });

  it('revert if public input for year is incorrect', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    const fakeProof = JSON.parse(JSON.stringify(proof)); // deep copy
    fakeProof.publicInputs[
      Number(await sc.ageCitizenshipKYC.INDEX_CURRENT_YEAR())
    ] = '0x123';

    await expect(
      sc.ageCitizenshipKYC
        .connect(acc.user)
        .verifyProof(proof.piA, proof.piB, proof.piC, fakeProof.publicInputs),
    ).to.be.revertedWith('the current year is incorrect');
  });

  it('should be able to update list of sanctioned countries', async () => {
    const { acc, sc, poseidon } = await loadFixture(deploy);
    const newCountryList = [
      hashStringToFieldNumber('GER', poseidon),
      '1',
      hashStringToFieldNumber('USA', poseidon),
    ].concat(Array(17).fill('0'));

    await sc.ageCitizenshipKYC
      .connect(acc.deployer)
      .setSanctionedCountries(newCountryList);

    for (let i = 0; i < newCountryList.length; i++) {
      expect(await sc.ageCitizenshipKYC.sanctionedCountries(i)).to.equal(
        newCountryList[i],
      );
    }
  });

  it('revert if citizenship is in list of sanctioned countries', async () => {
    const { acc, sc, sampleInput } = await loadFixture(deploy);

    const forgedInput = JSON.parse(JSON.stringify(sampleInput)); // deep copy
    forgedInput.countryExclusionList[0] = forgedInput.citizenship;

    const { proof, publicSignals } = await groth16.fullProve(
      forgedInput,
      circuitWasmPath,
      circuitZkeyPath,
    );
    const [piA, piB, piC] = processProof(proof);
    const publicInputs = processPublicSignals(publicSignals);

    const publicRoot =
      publicSignals[Number(await sc.ageCitizenshipKYC.INDEX_ROOT())];
    const publicTime = parseInt(
      publicSignals[Number(await sc.ageCitizenshipKYC.INDEX_CURRENT_TIME())],
      10,
    );
    // set the merkle root to the correct one
    await sc.mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      publicTime + 50,
    ]);

    await hre.network.provider.send('evm_mine');

    await expect(
      sc.ageCitizenshipKYC
        .connect(acc.user)
        .verifyProof(piC, piB, piA, publicInputs),
    ).to.be.revertedWith('the proof output is not valid');
  });

  it('revert if sanction list differs', async () => {
    const { acc, sc, proof, sampleInput } = await loadFixture(deploy);

    const newCountryList = JSON.parse(
      JSON.stringify(sampleInput.countryExclusionList),
    );
    newCountryList[0] = sampleInput.citizenship;

    await sc.ageCitizenshipKYC
      .connect(acc.deployer)
      .setSanctionedCountries(newCountryList);

    await expect(
      sc.ageCitizenshipKYC
        .connect(acc.user)
        .verifyProof(proof.piA, proof.piB, proof.piC, proof.publicInputs),
    ).to.be.revertedWith('the country sanction list differs');
  });

  it('should integrate in DApp and verificationSBT', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    await sc.kycRequirementsDemoDApp
      .connect(acc.user)
      .checkRequirements(proof.piA, proof.piB, proof.piC, proof.publicInputs);
    expect(
      await sc.kycRequirementsDemoDApp.passedRequirements(acc.user.address),
    ).to.be.true;

    // check repeatability
    await sc.kycRequirementsDemoDApp
      .connect(acc.user)
      .checkRequirements(proof.piA, proof.piB, proof.piC, proof.publicInputs);
    expect(
      await sc.kycRequirementsDemoDApp.passedRequirements(acc.user.address),
    ).to.be.true;
  });

  it('should reset verificationSBT', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    await sc.kycRequirementsDemoDApp
      .connect(acc.user)
      .checkRequirements(proof.piA, proof.piB, proof.piC, proof.publicInputs);
    expect(
      await sc.kycRequirementsDemoDApp.passedRequirements(acc.user.address),
    ).to.be.true;

    await sc.kycRequirementsDemoDApp.connect(acc.user).resetVerification();

    expect(
      await sc.kycRequirementsDemoDApp.passedRequirements(acc.user.address),
    ).to.be.false;
  });

  it('should check the age', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    expect(await sc.ageCitizenshipKYC.ageThreshold()).to.equal(18);

    await expect(
      sc.ageCitizenshipKYC.connect(acc.user).setAgeThreshold(12),
    ).to.be.revertedWith('Ownable: caller is not the owner');

    await sc.ageCitizenshipKYC.connect(acc.deployer).setAgeThreshold(21);
    expect(await sc.ageCitizenshipKYC.ageThreshold()).to.equal(21);

    await expect(
      sc.kycRequirementsDemoDApp
        .connect(acc.user)
        .checkRequirements(proof.piA, proof.piB, proof.piC, proof.publicInputs),
    ).to.be.revertedWith('the age threshold is not proven');
  });

  it('revert if provider is not whitelisted', async () => {
    const { acc, sc, proof } = await loadFixture(deploy);

    const publicRoot =
      proof.publicInputs[Number(await sc.ageCitizenshipKYC.INDEX_ROOT())];

    // set the merkle root to the correct one
    await sc.mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    const publicTime = parseInt(
      proof.publicInputs[
      Number(await sc.ageCitizenshipKYC.INDEX_CURRENT_TIME())
      ],
      16,
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      publicTime + 60,
    ]);
    await hre.network.provider.send('evm_mine');

    // Revoke the guardian role
    await sc.guardianRegistry.revokeGuardianRole(acc.deployer.address);

    await expect(
      sc.ageCitizenshipKYC
        .connect(acc.user)
        .verifyProof(proof.piA, proof.piB, proof.piC, proof.publicInputs),
    ).to.be.revertedWith('the provider is not whitelisted');
  });
});
