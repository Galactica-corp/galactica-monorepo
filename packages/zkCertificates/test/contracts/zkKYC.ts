/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';
import chai, { use } from 'chai';

chai.config.includeStack = true;

import { MockKYCRegistry } from '../../typechain-types/contracts/mock/MockKYCRegistry';
import { MockGalacticaInstitution } from '../../typechain-types/contracts/mock/MockGalacticaInstitution';
import { ZkKYC } from '../../typechain-types/contracts/ZkKYC';
import { ZkKYCVerifier } from '../../typechain-types/contracts/ZkKYCVerifier';

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
import { BigNumber } from 'ethers';
import { ZKCertificate } from '../../lib/zkCertificate';

const { expect } = chai;

describe('zkKYC SC', async () => {
  // reset the testing chain so we can perform time related tests
  /* await hre.network.provider.send('hardhat_reset'); */
  let zkKYCContract: ZkKYC;
  let zkKYCVerifier: ZkKYCVerifier;
  let mockKYCRegistry: MockKYCRegistry;
  let mockGalacticaInstitutions: MockGalacticaInstitution[];
  const amountInstitutions = 3;

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let zkKYC: ZKCertificate;
  let sampleInput: any, circuitWasmPath: string, circuitZkeyPath: string;

  beforeEach(async () => {
    // reset the testing chain so we can perform time related tests
    await hre.network.provider.send('hardhat_reset');

    [deployer, user, randomUser] = await hre.ethers.getSigners();

    // set up KYCRegistry, GalacticaInstitution, ZkKYCVerifier, ZkKYC
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

    const zkKYCVerifierFactory = await ethers.getContractFactory(
      'ZkKYCVerifier',
      deployer
    );
    zkKYCVerifier = (await zkKYCVerifierFactory.deploy()) as ZkKYCVerifier;

    const zkKYCFactory = await ethers.getContractFactory('ZkKYC', deployer);
    zkKYCContract = (await zkKYCFactory.deploy(
      deployer.address,
      zkKYCVerifier.address,
      mockKYCRegistry.address,
      []
    )) as ZkKYC;

    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(zkKYC, 0, zkKYCContract.address);

    // get signer object authorized to use the zkKYC record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    circuitWasmPath = './circuits/build/zkKYC.wasm';
    circuitZkeyPath = './circuits/build/zkKYC.zkey';
  });

  it('only owner can change KYCRegistry and Verifier addresses', async () => {
    // random user cannot change the addresses
    await expect(
      zkKYCContract.connect(user).setVerifier(user.address)
    ).to.be.rejectedWith('Ownable: caller is not the owner');
    await expect(
      zkKYCContract.connect(user).setKYCRegistry(user.address)
    ).to.be.rejectedWith('Ownable: caller is not the owner');

    //owner can change addresses
    await zkKYCContract.connect(deployer).setVerifier(user.address);
    await zkKYCContract.connect(deployer).setKYCRegistry(user.address);

    expect(await zkKYCContract.verifier()).to.be.equal(user.address);
    expect(await zkKYCContract.KYCRegistry()).to.be.equal(user.address);
  });

  it('correct proof can be verified onchain', async () => {
    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    const publicRoot = publicSignals[await zkKYCContract.INDEX_ROOT()];
    const publicTime = parseInt(publicSignals[await zkKYCContract.INDEX_CURRENT_TIME()], 10);
    // set the merkle root to the correct one
    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await zkKYCContract.connect(user).verifyProof(a, b, c, publicInputs);
  });

  it('incorrect proof failed to be verified', async () => {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    const publicRoot = publicSignals[await zkKYCContract.INDEX_ROOT()];
    // set the merkle root to the correct one
    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );
    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);

    // switch c, a to get an incorrect proof
    await expect(zkKYCContract.connect(user).verifyProof(c, b, a, publicInputs)).to.be
      .rejected;
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
    expect(publicSignals[await zkKYCContract.INDEX_IS_VALID()]).to.be.equal('0');
    const publicRoot = publicSignals[await zkKYCContract.INDEX_ROOT()];
    // set the merkle root to the correct one

    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );
    // set time to the public time
    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await expect(
      zkKYCContract.connect(user).verifyProof(c, b, a, publicInputs)
    ).to.be.rejectedWith('the proof output is not valid');
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
      zkKYCContract.connect(user).verifyProof(c, b, a, publicInputs)
    ).to.be.rejectedWith("the root in the proof doesn't match");
  });

  it('revert if time is too far from current time', async () => {
    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    const publicRoot = publicSignals[await zkKYCContract.INDEX_ROOT()];
    const publicTime = parseInt(publicSignals[await zkKYCContract.INDEX_CURRENT_TIME()], 10);
    // set the merkle root to the correct one

    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );
    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      publicTime + 200,
    ]);

    await hre.network.provider.send('evm_mine');
    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await expect(
      zkKYCContract.connect(user).verifyProof(c, b, a, publicInputs)
    ).to.be.rejectedWith('the current time is incorrect');
  });

  it('unauthorized user cannot use the proof', async () => {
    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath
    );

    const publicRoot = publicSignals[await zkKYCContract.INDEX_ROOT()];
    const publicTime = parseInt(publicSignals[await zkKYCContract.INDEX_CURRENT_TIME()], 10);
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
      zkKYCContract.connect(randomUser).verifyProof(c, b, a, publicInputs)
    ).to.be.rejectedWith(
      'transaction submitter is not authorized to use this proof'
    );
  });

  it('should work with investigation institutions and shamir secret sharing', async () => {
    // for fraud investigation, we have different circuit parameters and therefore different input and verifier
    zkKYC = await generateSampleZkKYC();
    const inputWithInstitutions = await generateZkKYCProofInput(zkKYC, amountInstitutions, zkKYCContract.address);

    const zkKYCVerifierFactory = await ethers.getContractFactory(
      'InvestigatableZkKYCVerifier',
      deployer
    );
    const verifierSC = (await zkKYCVerifierFactory.deploy()) as ZkKYCVerifier;

    const zkKYCFactory = await ethers.getContractFactory('ZkKYC', deployer);
    const investigatableZkKYC = (await zkKYCFactory.deploy(
      deployer.address,
      verifierSC.address,
      mockKYCRegistry.address,
      mockGalacticaInstitutions.map((inst) => inst.address),
    )) as ZkKYC;

    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputWithInstitutions,
      './circuits/build/investigatableZkKYC.wasm',
      './circuits/build/investigatableZkKYC.zkey'
    );

    // set the institution pub keys
    for (let i = 0; i < amountInstitutions; i++) {
      const galacticaInstitutionPubKey: [BigNumber, BigNumber] = [
        publicSignals[await investigatableZkKYC.START_INDEX_INVESTIGATION_INSTITUTIONS() + 2 * i],
        publicSignals[await investigatableZkKYC.START_INDEX_INVESTIGATION_INSTITUTIONS() + 2 * i + 1]
      ];
      await mockGalacticaInstitutions[i].setInstitutionPubkey(
        galacticaInstitutionPubKey
      );
    }

    const publicRoot = publicSignals[await investigatableZkKYC.INDEX_ROOT()];
    const publicTime = parseInt(publicSignals[await investigatableZkKYC.INDEX_CURRENT_TIME()], 10);
    // set the merkle root to the correct one
    await mockKYCRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot))
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    let [a, b, c] = processProof(proof);

    let publicInputs = processPublicSignals(publicSignals);
    await investigatableZkKYC.connect(user).verifyProof(a, b, c, publicInputs);

    // also check that it correctly reverts if an institution key is wrong
    // set different institution pub key
    const galacticaInstitutionPubKey: [BigNumber, BigNumber] = [
      BigNumber.from(publicSignals[await zkKYCContract.START_INDEX_INVESTIGATION_INSTITUTIONS()]).add('1'),
      publicSignals[await zkKYCContract.START_INDEX_INVESTIGATION_INSTITUTIONS() + 1]
    ];
    await mockGalacticaInstitutions[2].setInstitutionPubkey(
      galacticaInstitutionPubKey
    );
    await expect(
      investigatableZkKYC.connect(user).verifyProof(a, b, c, publicInputs)
    ).to.be.rejectedWith('the first part of institution pubkey is incorrect');
  });
});
