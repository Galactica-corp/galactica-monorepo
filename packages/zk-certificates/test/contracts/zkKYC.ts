/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import chai from 'chai';
import type { BigNumberish } from 'ethers';
import hre, { ethers, ignition } from 'hardhat';
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
import type { GuardianRegistry } from '../../typechain-types/contracts/GuardianRegistry';
import type { MockGalacticaInstitution } from '../../typechain-types/contracts/mock/MockGalacticaInstitution';
import type { MockZkCertificateRegistry } from '../../typechain-types/contracts/mock/MockZkCertificateRegistry';
import type { ZkKYC } from '../../typechain-types/contracts/verifierWrappers/ZkKYC';
import type { ZkKYCVerifier } from '../../typechain-types/contracts/zkpVerifiers/ZkKYCVerifier';
import guardianRegistryModule from '../../ignition/modules/GuardianRegistry.m';

chai.config.includeStack = true;

const { expect } = chai;

describe('zkKYC SC', () => {
  // reset the testing chain so we can perform time related tests
  /* await hre.network.provider.send('hardhat_reset'); */
  let zkKYCContract: ZkKYC;
  let zkKYCVerifier: ZkKYCVerifier;
  let mockZkCertificateRegistry: MockZkCertificateRegistry;
  let mockGalacticaInstitutions: MockGalacticaInstitution[];
  let guardianRegistry: GuardianRegistry;
  const amountInstitutions = 3;

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let zkKYC: ZkCertificate;
  let sampleInput: any, circuitWasmPath: string, circuitZkeyPath: string;

  beforeEach(async () => {
    // Reset the testing chain
    await hre.network.provider.send('hardhat_reset');

    [deployer, user, randomUser] = await hre.ethers.getSigners();

    // set up KYCRegistry, GalacticaInstitution, ZkKYCVerifier, ZkKYC
    mockZkCertificateRegistry = await ethers.deployContract(
      'MockZkCertificateRegistry',
    );

    const ignitionContracts = await ignition.deploy(
      guardianRegistryModule,
      {
        parameters: {
          GuardianRegistryModule: {
            description: 'https://example.com/metadata',
          },
        },
      },
    );
    guardianRegistry = ignitionContracts.guardianRegistry as unknown as GuardianRegistry;

    await mockZkCertificateRegistry.setGuardianRegistry(
      await guardianRegistry.getAddress(),
    );

    mockGalacticaInstitutions = [];
    for (let i = 0; i < amountInstitutions; i++) {
      mockGalacticaInstitutions.push(
        await ethers.deployContract('MockGalacticaInstitution'),
      );
    }

    zkKYCVerifier = await ethers.deployContract('ZkKYCVerifier');

    zkKYCContract = await ethers.deployContract('ZkKYC', [
      deployer.address,
      await zkKYCVerifier.getAddress(),
      await mockZkCertificateRegistry.getAddress(),
      [],
    ]);
    await zkKYCContract.waitForDeployment();

    // Generate sample ZkKYC and proof input
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(
      zkKYC,
      0,
      await zkKYCContract.getAddress(),
    );

    // get signer object authorized to use the zkKYC record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    circuitWasmPath = './circuits/build/zkKYC.wasm';
    circuitZkeyPath = './circuits/build/zkKYC.zkey';

    // Grant guardian role to deployer
    const { providerData } = zkKYC;
    await guardianRegistry.grantGuardianRole(
      deployer.address,
      [providerData.ax, providerData.ay],
      'https://example.com/guardian-metadata',
    );
  });

  it('only owner can change KYCRegistry and Verifier addresses', async () => {
    // random user cannot change the addresses
    await expect(
      zkKYCContract.connect(user).setVerifier(user.address),
    ).to.be.revertedWithCustomError(
      zkKYCContract,
      'OwnableUnauthorizedAccount',
    );
    await expect(
      zkKYCContract.connect(user).setKYCRegistry(user.address),
    ).to.be.revertedWithCustomError(
      zkKYCContract,
      'OwnableUnauthorizedAccount',
    );

    // owner can change addresses
    await zkKYCContract.connect(deployer).setVerifier(user.address);
    await zkKYCContract.connect(deployer).setKYCRegistry(user.address);

    expect(await zkKYCContract.verifier()).to.be.equal(user.address);
    expect(await zkKYCContract.KYCRegistry()).to.be.equal(user.address);
  });

  it('correct proof can be verified onchain', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[Number(await zkKYCContract.INDEX_ROOT())];

    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    const publicTime = parseInt(
      publicSignals[Number(await zkKYCContract.INDEX_CURRENT_TIME())],
      10,
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);

    await zkKYCContract.connect(user).verifyProof(piA, piB, piC, publicInputs);
  });

  it('proof with older but still valid merkle root can still be verified', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[Number(await zkKYCContract.INDEX_ROOT())];
    const publicTime = parseInt(
      publicSignals[Number(await zkKYCContract.INDEX_CURRENT_TIME())],
      10,
    );
    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    // add a new merkle root
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex('0x11')),
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await zkKYCContract.connect(user).verifyProof(piA, piB, piC, publicInputs);
  });

  it('revert for proof with old merkle root', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[Number(await zkKYCContract.INDEX_ROOT())];
    const publicTime = parseInt(
      publicSignals[Number(await zkKYCContract.INDEX_CURRENT_TIME())],
      10,
    );
    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    // add a new merkle root
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex('0x11')),
    );

    // increase the merkleRootValidIndex
    await mockZkCertificateRegistry.setMerkleRootValidIndex(3);

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      zkKYCContract.connect(user).verifyProof(piC, piB, piA, publicInputs),
    ).to.be.revertedWith('invalid merkle root');
  });

  it('incorrect proof failed to be verified', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[Number(await zkKYCContract.INDEX_ROOT())];
    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);

    // switch c, a to get an incorrect proof
    await expect(
      zkKYCContract.connect(user).verifyProof(piC, piB, piA, publicInputs),
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
    expect(
      publicSignals[Number(await zkKYCContract.INDEX_IS_VALID())],
    ).to.be.equal('0');
    const publicRoot = publicSignals[Number(await zkKYCContract.INDEX_ROOT())];
    // set the merkle root to the correct one

    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    // set time to the public time
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      zkKYCContract.connect(user).verifyProof(piA, piB, piC, publicInputs),
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
      zkKYCContract.connect(user).verifyProof(piA, piB, piC, publicInputs),
    ).to.be.revertedWith('invalid merkle root');
  });

  it('revert if time is too far from current time', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[Number(await zkKYCContract.INDEX_ROOT())];
    const publicTime = parseInt(
      publicSignals[Number(await zkKYCContract.INDEX_CURRENT_TIME())],
      10,
    );
    // set the merkle root to the correct one

    await mockZkCertificateRegistry.setMerkleRoot(
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
      zkKYCContract.connect(user).verifyProof(piA, piB, piC, publicInputs),
    ).to.be.revertedWith('the current time is incorrect');
  });

  it('unauthorized user cannot use the proof', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[Number(await zkKYCContract.INDEX_ROOT())];
    const publicTime = parseInt(
      publicSignals[Number(await zkKYCContract.INDEX_CURRENT_TIME())],
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
    await expect(
      zkKYCContract
        .connect(randomUser)
        .verifyProof(piA, piB, piC, publicInputs),
    ).to.be.revertedWith(
      'transaction submitter is not authorized to use this proof',
    );
  });

  it('should work with investigation institutions and shamir secret sharing', async () => {
    // for fraud investigation, we have different circuit parameters and therefore different input and verifier
    zkKYC = await generateSampleZkKYC();
    const inputWithInstitutions = await generateZkKYCProofInput(
      zkKYC,
      amountInstitutions,
      await zkKYCContract.getAddress(),
    );

    const verifierSC = (await ethers.deployContract(
      'InvestigatableZkKYCVerifier',
    )) as ZkKYCVerifier;

    const investigatableZkKYC = await ethers.deployContract('ZkKYC', [
      deployer.address,
      await verifierSC.getAddress(),
      await mockZkCertificateRegistry.getAddress(),
      await Promise.all(
        mockGalacticaInstitutions.map(async (inst) => inst.getAddress()),
      ),
    ]);

    const { proof, publicSignals } = await groth16.fullProve(
      inputWithInstitutions,
      './circuits/build/investigatableZkKYC.wasm',
      './circuits/build/investigatableZkKYC.zkey',
    );

    // set the institution pub keys
    const startIndexInvestigatable = Number(
      await investigatableZkKYC.START_INDEX_INVESTIGATION_INSTITUTIONS(),
    );
    for (let i = 0; i < amountInstitutions; i++) {
      const galacticaInstitutionPubKey: [BigNumberish, BigNumberish] = [
        publicSignals[startIndexInvestigatable + 2 * i],
        publicSignals[startIndexInvestigatable + 2 * i + 1],
      ];
      await mockGalacticaInstitutions[i].setInstitutionPubkey(
        galacticaInstitutionPubKey,
      );
    }

    const publicRoot =
      publicSignals[Number(await investigatableZkKYC.INDEX_ROOT())];
    const publicTime = parseInt(
      publicSignals[Number(await investigatableZkKYC.INDEX_CURRENT_TIME())],
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
    await investigatableZkKYC
      .connect(user)
      .verifyProof(piA, piB, piC, publicInputs);

    // also check that it correctly reverts if an institution key is wrong
    // set different institution pub key
    const startIndexBasic: number = Number(
      await zkKYCContract.START_INDEX_INVESTIGATION_INSTITUTIONS(),
    );
    const galacticaInstitutionPubKey: [BigNumberish, BigNumberish] = [
      BigInt(publicSignals[startIndexBasic]) + BigInt(1),
      publicSignals[startIndexBasic + 1],
    ];
    await mockGalacticaInstitutions[2].setInstitutionPubkey(
      galacticaInstitutionPubKey,
    );
    await expect(
      investigatableZkKYC
        .connect(user)
        .verifyProof(piA, piB, piC, publicInputs),
    ).to.be.revertedWith('the first part of institution pubkey is incorrect');
  });

  it('revert if provider is not whitelisted', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[Number(await zkKYCContract.INDEX_ROOT())];

    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    const publicTime = parseInt(
      publicSignals[Number(await zkKYCContract.INDEX_CURRENT_TIME())],
      10,
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await guardianRegistry.revokeGuardianRole(deployer.address);

    await expect(
      zkKYCContract.connect(user).verifyProof(piA, piB, piC, publicInputs),
    ).to.be.revertedWith('the provider is not whitelisted');
  });
});
