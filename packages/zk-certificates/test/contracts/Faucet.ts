/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
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
} from '../../scripts/generateZkKYCInput';
import type { Faucet } from '../../typechain-types/contracts/Faucet';
import type { GalacticaOfficialSBT } from '../../typechain-types/contracts/GalacticaOfficialSBT';
import type { MockGalacticaInstitution } from '../../typechain-types/contracts/mock/MockGalacticaInstitution';
import type { MockToken } from '../../typechain-types/contracts/mock/MockToken';
import type { MockZkCertificateRegistry } from '../../typechain-types/contracts/mock/MockZkCertificateRegistry';
import type { ZkKYC } from '../../typechain-types/contracts/ZkKYC';
import type { ZkKYCVerifier } from '../../typechain-types/contracts/zkpVerifiers/ZkKYCVerifier';

chai.config.includeStack = true;

const { expect } = chai;

describe.only('AirdropGateway', () => {
  // reset the testing chain so we can perform time related tests
  /* await hre.network.provider.send('hardhat_reset'); */
  let faucet: Faucet;
  let mockGalacticaInstitutions: MockGalacticaInstitution[];
  const amountInstitutions = 3;
  let epochDuration: number;
  let epochStartTime: number;
  let amountPerEpoch: number;

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let zkKYC: ZkCertificate;
  let client: SignerWithAddress;
  let clientRole: string;
  let defaultAdminRole: string;
  let sampleInput: any, circuitWasmPath: string, circuitZkeyPath: string;
  let sampleInput2: any;

  beforeEach(async () => {
    // reset the testing chain so we can perform time related tests
    await hre.network.provider.send('hardhat_reset');

    [deployer, user, user2, randomUser, client] = await hre.ethers.getSigners();

    // set up KYCRegistry, GalacticaInstitution, ZkKYCVerifier, ZkKYC
    const mockZkCertificateRegistryFactory = await ethers.getContractFactory(
      'MockZkCertificateRegistry',
      deployer,
    );
    mockZkCertificateRegistry =
      (await mockZkCertificateRegistryFactory.deploy()) as MockZkCertificateRegistry;

    const mockGalacticaInstitutionFactory = await ethers.getContractFactory(
      'MockGalacticaInstitution',
      deployer,
    );
    mockGalacticaInstitutions = [];
    for (let i = 0; i < amountInstitutions; i++) {
      mockGalacticaInstitutions.push(
        (await mockGalacticaInstitutionFactory.deploy()) as MockGalacticaInstitution,
      );
    }
    
    // interaction with zkKYC has been tested in AirdropGateway and BasicKYCExampleDAppTest
    const MockZkKYCFactory = await hre.ethers.getContractFactory('MockZkKYC');
    const mockZkKYC = await MockZkKYCFactory.deploy();
    await mockZkKYC.deployed();

    // set up VerificationSBT
    const verificationSBTFactory = await ethers.getContractFactory(
      'VerificationSBT',
      deployer,
    );
    verificationSBT = (await verificationSBTFactory.deploy(
      'test URI',
      'VerificationSBT',
      'VerificationSBT',
    )) as VerificationSBT;

    // set up the faucet
    epochDuration = 100;
    epochStartTime = (await hre.ethers.provider.getBlock("latest")).timestamp;
    amountPerEpoch = ethers.utils.parseEther("1");

    const faucetFactory = await ethers.getContractFactory(
      'Faucet',
      deployer,
    );
    faucet = (await faucetFactory.deploy(
      deployer.address,
      epochDuration,
      epochStartTime,
      amountPerEpoch,
      mockZkKYC.address,
      verificationSBT.address,  
    )) as Faucet;
  
        // make zkKYC record for airdropGateway
        zkKYC = await generateSampleZkKYC();
        sampleInput = await generateZkKYCProofInput(
          zkKYC,
          0,
          faucet.address,
        );

        circuitWasmPath = './circuits/build/zkKYC.wasm';
        circuitZkeyPath = './circuits/build/zkKYC.zkey';
  });

  it('users can claim', async () => {
    // first we send some fund to the contract
    await deployer.sendTransaction({
      to: faucet.address,
      value: ethers.utils.parseEther("100"),
    });



    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);


    const humanID1 = ethers.utils.randomBytes(32);
    const humanID2 = ethers.utils.randomBytes(32);

    const HUMAN_ID_INDEX = 0;
    const INDEX_VERIFICATION_EXPIRATION = 4;
    const USER_ADDRESS_INDEX = 7 + amountInstitutions * 2;
    // we set up relevant public info
    publicInputs[HUMAN_ID_INDEX] = humanID1;
    publicInputs[USER_ADDRESS_INDEX] = user.address;
    publicInputs[INDEX_VERIFICATION_EXPIRATION] = epochStartTime + epochDuration * 4;

    // now at epoch 2 when we call from any account the claimWithoutSBT for user
    // he should receive 2 epochs worth of funds and an SBT

    // we set the time to epoch 2
    await hre.network.provider.send('evm_setNextBlockTimestamp', [epochStartTime + epochDuration * 1.5]);
    await hre.network.provider.send('evm_mine');

    let userBalanceBefore = await ethers.provider.getBalance(user.address);

    await faucet.claimWithoutSBT(
      piA,
      piB,
      piC,
      publicInputs
    );

    let userBalanceAfter = await ethers.provider.getBalance(user.address);

    expect(userBalanceAfter).to.be.equal(userBalanceBefore + amountPerEpoch * 2);

    



  });

});
