/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import chai from 'chai';
import hre, { ethers } from 'hardhat';
import { groth16 } from 'snarkjs';

import {
  fromDecToHex,
  fromHexToBytes32,
  processProof,
  processPublicSignals,
} from '../../lib/helpers';
import type { ZkCertificate } from '../../lib/zkCertificate';
import {
  generateSampleZkKYC,
  generateZkKYCProofInput,
} from '../../scripts/dev/generateZkKYCInput';
import type { BasicKYCExampleDApp } from '../../typechain-types/contracts/dapps/BasicKYCExampleDApp';
import type { GuardianRegistry } from '../../typechain-types/contracts/GuardianRegistry';
import type { MockZkCertificateRegistry } from '../../typechain-types/contracts/mock/MockZkCertificateRegistry';
import type { VerificationSBT } from '../../typechain-types/contracts/SBT_related/VerificationSBT';
import type { ZkKYC } from '../../typechain-types/contracts/verifierWrappers/ZkKYC';
import type { ZkKYCVerifier } from '../../typechain-types/contracts/zkpVerifiers/ZkKYCVerifier';

chai.config.includeStack = true;
const { expect } = chai;

describe('BasicKYCExampleDApp', () => {
  // reset the testing chain so we can perform time related tests
  /* await hre.network.provider.send('hardhat_reset'); */
  let zkKycSC: ZkKYC;
  let zkKYCVerifier: ZkKYCVerifier;
  let mockZkCertificateRegistry: MockZkCertificateRegistry;
  let verificationSBT: VerificationSBT;
  let basicExampleDApp: BasicKYCExampleDApp;
  let guardianRegistry: GuardianRegistry;

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let zkKYC: ZkCertificate;
  let sampleInput: any, circuitWasmPath: string, circuitZkeyPath: string;

  beforeEach(async () => {
    // TODO: use fixture instead
    // reset the testing chain so we can perform time related tests
    await hre.network.provider.send('hardhat_reset');

    [deployer, user] = await hre.ethers.getSigners();

    // set up KYCRegistry, ZkKYCVerifier, ZkKYC
    mockZkCertificateRegistry = (await ethers.deployContract(
      'MockZkCertificateRegistry',
    )) as MockZkCertificateRegistry;

    zkKYCVerifier = (await ethers.deployContract(
      'ZkKYCVerifier',
    )) as ZkKYCVerifier;

    zkKycSC = (await ethers.deployContract('ZkKYC', [
      deployer.address,
      await zkKYCVerifier.getAddress(),
      await mockZkCertificateRegistry.getAddress(),
      [],
    ])) as ZkKYC;
    await zkKycSC.waitForDeployment();

    basicExampleDApp = (await ethers.deployContract('BasicKYCExampleDApp', [
      await zkKycSC.getAddress(),
      'test URI',
      'VerificationSBT',
      'VerificationSBT',
    ])) as BasicKYCExampleDApp;

    verificationSBT = (await ethers.getContractAt(
      'VerificationSBT',
      await basicExampleDApp.sbt(),
    )) as VerificationSBT;

    // inputs to create proof
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(
      zkKYC,
      0,
      await basicExampleDApp.getAddress(),
    );
    sampleInput.dAppAddress = await basicExampleDApp.getAddress();

    // advance time a bit to set it later in the test
    sampleInput.currentTime += 100;

    // get signer object authorized to use the zkKYC record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    circuitWasmPath = './circuits/build/zkKYC.wasm';
    circuitZkeyPath = './circuits/build/zkKYC.zkey';

    // Deploy GuardianRegistry
    guardianRegistry = (await ethers.deployContract('GuardianRegistry', [
      'https://example.com/metadata',
    ])) as GuardianRegistry;
    await guardianRegistry.waitForDeployment();

    // Set GuardianRegistry in MockZkCertificateRegistry
    await mockZkCertificateRegistry.setGuardianRegistry(
      await guardianRegistry.getAddress(),
    );

    // Approve the provider's public key
    await guardianRegistry.grantGuardianRole(
      deployer.address,
      [zkKYC.providerData.ax, zkKYC.providerData.ay],
      'https://example.com/provider-metadata',
    );
  });

  it('should issue VerificationSBT on correct proof and refuse to re-register before expiration', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[Number(await zkKycSC.INDEX_ROOT())];
    const publicTime = parseInt(
      publicSignals[Number(await zkKycSC.INDEX_CURRENT_TIME())],
      10,
    );
    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    let [piA, piB, piC] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);

    await basicExampleDApp
      .connect(user)
      .registerKYC(piA, piB, piC, publicInputs);

    expect(await verificationSBT.isVerificationSBTValid(user.address)).to.be
      .true;

    await expect(
      basicExampleDApp.connect(user).registerKYC(piA, piB, piC, publicInputs),
    ).to.be.revertedWith(
      'The user already has a verification SBT. Please wait until it expires.',
    );

    // wait until verification SBT expires to renew it
    const sbt = await verificationSBT.getVerificationSBTInfo(user.address);
    const laterProofInput = { ...sampleInput };
    const expirationTime: number = Number(sbt.expirationTime);
    laterProofInput.currentTime = expirationTime + 1;
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      laterProofInput.currentTime,
    ]);
    await hre.network.provider.send('evm_mine');

    expect(await verificationSBT.isVerificationSBTValid(user.address)).to.be
      .false;

    const laterProof = await groth16.fullProve(
      laterProofInput,
      circuitWasmPath,
      circuitZkeyPath,
    );
    [piA, piB, piC] = processProof(laterProof.proof);
    publicInputs = processPublicSignals(laterProof.publicSignals);
    await basicExampleDApp
      .connect(user)
      .registerKYC(piA, piB, piC, laterProof.publicSignals);

    expect(await verificationSBT.isVerificationSBTValid(user.address)).to.be
      .true;
  });

  it('should catch incorrect proof', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[Number(await zkKycSC.INDEX_ROOT())];
    // set the merkle root to the correct one

    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);

    // switch c, a to get an incorrect proof
    // it doesn't fail on time because the time change remains from the previous test
    await expect(
      basicExampleDApp.connect(user).registerKYC(piC, piB, piA, publicInputs),
    ).to.be.reverted;
  });
});
