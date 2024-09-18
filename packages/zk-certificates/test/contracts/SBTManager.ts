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
  generateSampleTwitterZkCertificate,
  generateTwitterZkCertificateProofInput,
} from '../../scripts/generateTwitterZkCertificateInput';
import type { AirdropGateway } from '../../typechain-types/contracts/AirdropGateway';
import type { GalacticaOfficialSBT } from '../../typechain-types/contracts/GalacticaOfficialSBT';
import type { MockGalacticaInstitution } from '../../typechain-types/contracts/mock/MockGalacticaInstitution';
import type { MockToken } from '../../typechain-types/contracts/mock/MockToken';
import type { MockZkCertificateRegistry } from '../../typechain-types/contracts/mock/MockZkCertificateRegistry';
import type { SBTManager } from '../../typechain-types/contracts/SBT_related/SBTManager';
import type { TwitterFollowersCountProof } from '../../typechain-types/contracts/TwitterFollowersCountProof';
import type { TwitterFollowersCountProofVerifier } from '../../typechain-types/contracts/zkpVerifiers/TwitterFollowersCountProofVerifier';
import type { TwitterCreationTimeProof} from '../../typechain-types/contracts/TwitterCreationTimeProof';
import type { TwitterCreationTimeProofVerifier } from '../../typechain-types/contracts/zkpVerifiers/TwitterCreationTimeProofVerifier';
import twitterExample from '../../example/twitterFields.json';


chai.config.includeStack = true;

const { expect } = chai;

describe('SBTManager', () => {
  // reset the testing chain so we can perform time related tests
  /* await hre.network.provider.send('hardhat_reset'); */
  let SBTManager: SBTManager;
  let rewardToken: MockToken;
  let twitterFollowersCountProof: TwitterFollowersCountProof;
  let twitterFollowersCountProofVerifier: TwitterFollowersCountProofVerifier;
  let twitterCreationTimeProof: TwitterCreationTimeProof;
  let twitterCreationTimeProofVerifier: TwitterCreationTimeProofVerifier;
  let mockZkCertificateRegistry: MockZkCertificateRegistry;
  let mockGalacticaInstitutions: MockGalacticaInstitution[];
  let SBTs: GalacticaOfficialSBT[];

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let twitterZkCertificates: ZkCertificate[];
  let client: SignerWithAddress;
  let clientRole: string;
  let defaultAdminRole: string;
  let sampleInputs: any[];
  let circuitWasmPath1: string;
  let circuitZkeyPath1: string;
  let circuitWasmPath2: string;
  let circuitZkeyPath2: string;

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

    const twitterFollowersCountProofVerifierFactory =
      await ethers.getContractFactory(
        'TwitterFollowersCountProofVerifier',
        deployer,
      );
    twitterFollowersCountProofVerifier =
      (await twitterFollowersCountProofVerifierFactory.deploy()) as TwitterFollowersCountProofVerifier;

    const twitterFollowersCountProofFactory = await ethers.getContractFactory(
      'TwitterFollowersCountProof',
      deployer,
    );
    twitterFollowersCountProof =
      (await twitterFollowersCountProofFactory.deploy(
        deployer.address,
        twitterFollowersCountProofVerifier.address,
        mockZkCertificateRegistry.address,
        [],
      )) as TwitterFollowersCountProof;

    const twitterCreationTimeProofVerifierFactory =
      await ethers.getContractFactory(
        'TwitterCreationTimeProofVerifier',
        deployer,
      );
    twitterCreationTimeProofVerifier =
      (await twitterCreationTimeProofVerifierFactory.deploy()) as TwitterCreationTimeProofVerifier;

    const twitterCreationTimeProofFactory = await ethers.getContractFactory(
      'TwitterCreationTimeProof',
      deployer,
    );
    twitterCreationTimeProof = (await twitterCreationTimeProofFactory.deploy(
      deployer.address,
      twitterCreationTimeProofVerifier.address,
      mockZkCertificateRegistry.address,
      [],
    )) as TwitterCreationTimeProof;

    // set up airdropGateway and set up the client
    const SBTManagerFactory = await ethers.getContractFactory(
      'SBTManager',
      deployer,
    );

    SBTManager = (await SBTManagerFactory.deploy(
      deployer.address,
    )) as SBTManager;

    twitterZkCertificates = [];
    const twitterExample1 = twitterExample;
    twitterExample1.followersCount = 110;
    twitterZkCertificates.push(await generateSampleTwitterZkCertificate(twitterExample1));

    const twitterExample2 = twitterExample;
    twitterExample2.followersCount = 1100;
    twitterZkCertificates.push(await generateSampleTwitterZkCertificate(twitterExample2));

    const twitterExample3 = twitterExample;
    twitterExample3.followersCount = 11000;
    twitterZkCertificates.push(await generateSampleTwitterZkCertificate(twitterExample3));

    const twitterExample4 = twitterExample;
    twitterExample4.createdAt = 1514764800; // before 2020-01-01
    twitterZkCertificates.push(await generateSampleTwitterZkCertificate(twitterExample4));

    const twitterExample5 = twitterExample;
    twitterExample5.createdAt = 1714867200; // after 2024-01-01
    twitterZkCertificates.push(await generateSampleTwitterZkCertificate(twitterExample5));

    sampleInputs = [];
    sampleInputs.push(
      await generateTwitterZkCertificateProofInput(twitterZkCertificates[0]),
    );
    sampleInputs[0].followersCountThreshold = 100;

    sampleInputs.push(
      await generateTwitterZkCertificateProofInput(twitterZkCertificates[1]),
    );
    sampleInputs[1].followersCountThreshold = 1000;

    sampleInputs.push(
      await generateTwitterZkCertificateProofInput(twitterZkCertificates[2]),
    );
    sampleInputs[2].followersCountThreshold = 100000;

    sampleInputs.push(
      await generateTwitterZkCertificateProofInput(twitterZkCertificates[3]),
    );
    sampleInputs[3].creationTimeLowerBound = 0;
    sampleInputs[3].creationTimeUpperBound = 1577836800;

    sampleInputs.push(
      await generateTwitterZkCertificateProofInput(twitterZkCertificates[4]),
    );
    sampleInputs[4].creationTimeLowerBound = 1704067200;
    sampleInputs[4].creationTimeUpperBound = 1735689600;

    // get signer object authorized to use the zkCertificate record
    user = await hre.ethers.getImpersonatedSigner(sampleInputs[0].userAddress);

    circuitWasmPath1 = './circuits/build/twitterFollowersCountProof.wasm';
    circuitZkeyPath1 = './circuits/build/twitterFollowersCountProof.zkey';

    circuitWasmPath2 = './circuits/build/twitterCreationTimeProof.wasm';
    circuitZkeyPath2 = './circuits/build/twitterCreationTimeProof.zkey';

    // deploying the SBTs
    SBTs = [];
    for (let i = 0; i < 5; i++) {
      const SBTFactory = await ethers.getContractFactory(
        'GalacticaOfficialSBT',
        deployer,
      );
      SBTs.push((await SBTFactory.deploy(deployer.address, `test_${i}`, deployer.address, `test_${i}`, `test_${i}` )) as GalacticaOfficialSBT);
    }

    // set up the verifier wrappers and SBTs addresses in the SBTManager contract
    for (let i = 0; i < 5; i++) {
      await SBTManager.setSBT(i, SBTs[i].address);
      if (i < 3) {
        await SBTManager.setVerifierWrapper(i, twitterFollowersCountProof.address);
      } else {
        await SBTManager.setVerifierWrapper(i, twitterCreationTimeProof.address);

      }
    }
  });
  it.only('only owner can assign SBTs and verifier wrappers', async () => {
    // random user cannot whitelist
    await expect(
      SBTManager.connect(randomUser).setSBT(0, SBTs[0].address),
    ).to.be.revertedWith(
      'Ownable: caller is not the owner',
    );

    await expect(
      SBTManager.connect(randomUser).setVerifierWrapper(0, SBTs[0].address),
    ).to.be.revertedWith(
      'Ownable: caller is not the owner',
    );
  });

  it.only('check that user can only receive the SBT after fulfilling the condition', async () => {
    // random user cannot whitelist
    await expect(
      SBTManager.connect(randomUser).setSBT(0, SBTs[0].address),
    ).to.be.revertedWith(
      'Ownable: caller is not the owner',
    );

    await expect(
      SBTManager.connect(randomUser).setVerifierWrapper(0, SBTs[0].address),
    ).to.be.revertedWith(
      'Ownable: caller is not the owner',
    );
  });
});
