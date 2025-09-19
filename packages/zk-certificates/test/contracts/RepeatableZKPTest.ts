/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import chai from 'chai';
import hre, { ethers, ignition } from 'hardhat';
import { groth16 } from 'snarkjs';

import guardianRegistryModule from '../../ignition/modules/GuardianRegistry.m';
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
import type { GuardianRegistry } from '../../typechain-types/contracts/GuardianRegistry';
import type { MockZkCertificateRegistry } from '../../typechain-types/contracts/mock/MockZkCertificateRegistry';
import type { RepeatableZKPTest } from '../../typechain-types/contracts/mock/RepeatableZKPTest';
import type { VerificationSBT } from '../../typechain-types/contracts/SBT_related/VerificationSBT';
import type { ZkKYC } from '../../typechain-types/contracts/verifierWrappers/ZkKYC';
import type { ZkKYCVerifier } from '../../typechain-types/contracts/zkpVerifiers/ZkKYCVerifier';

chai.config.includeStack = true;
const { expect } = chai;

describe('RepeatableZKPTest', () => {
  // reset the testing chain so we can perform time related tests
  /* await hre.network.provider.send('hardhat_reset'); */
  let zkKycSC: ZkKYC;
  let zkKYCVerifier: ZkKYCVerifier;
  let mockZkCertificateRegistry: MockZkCertificateRegistry;
  let verificationSBT: VerificationSBT;
  let repeatableZKPTest: RepeatableZKPTest;
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

    const ignitionContracts = await ignition.deploy(guardianRegistryModule, {
      parameters: {
        GuardianRegistryModule: {
          description: 'https://example.com/metadata',
        },
      },
    });
    guardianRegistry =
      ignitionContracts.guardianRegistry as unknown as GuardianRegistry;
    await guardianRegistry.waitForDeployment();

    mockZkCertificateRegistry = await ethers.deployContract(
      'MockZkCertificateRegistry',
    );

    // Set GuardianRegistry in MockZkCertificateRegistry
    await mockZkCertificateRegistry.setGuardianRegistry(
      await guardianRegistry.getAddress(),
    );

    zkKYCVerifier = await ethers.deployContract('ZkKYCVerifier');

    zkKycSC = await ethers.deployContract('ZkKYC', [
      deployer.address,
      await zkKYCVerifier.getAddress(),
      await mockZkCertificateRegistry.getAddress(),
      [],
    ]);
    await zkKYCVerifier.waitForDeployment();

    repeatableZKPTest = await ethers.deployContract('RepeatableZKPTest', [
      await zkKycSC.getAddress(),
      'test URI',
      'VerificationSBT',
      'VerificationSBT',
    ]);

    verificationSBT = await ethers.getContractAt(
      'VerificationSBT',
      await repeatableZKPTest.sbt(),
    );

    // inputs to create proof
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(
      zkKYC,
      0,
      await repeatableZKPTest.getAddress(),
    );
    sampleInput.dAppAddress = await repeatableZKPTest.getAddress();

    // Approve the provider's public key
    await guardianRegistry.grantGuardianRole(
      deployer.address,
      [zkKYC.providerData.ax, zkKYC.providerData.ay],
      'https://example.com/provider-metadata',
    );

    // advance time a bit to set it later in the test
    sampleInput.currentTime += 100;

    // get signer object authorized to use the zkKYC record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    circuitWasmPath = './circuits/build/zkKYC.wasm';
    circuitZkeyPath = './circuits/build/zkKYC.zkey';
  });

  it('should issue VerificationSBT on correct proof and accept ZKP multiple times', async () => {
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

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await repeatableZKPTest
      .connect(user)
      .submitZKP(piA, piB, piC, publicInputs);

    expect(await verificationSBT.isVerificationSBTValid(user.address)).to.be
      .true;

    await repeatableZKPTest
      .connect(user)
      .submitZKP(piA, piB, piC, publicInputs);
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
      repeatableZKPTest.connect(user).submitZKP(piC, piB, piA, publicInputs),
    ).to.be.reverted;
  });
});
