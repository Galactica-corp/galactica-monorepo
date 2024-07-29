/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import { BigNumber } from 'ethers';
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
import type { AirdropGateway } from '../../typechain-types/contracts/AirdropGateway';
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
  let airdropGateway: AirdropGateway;
  let rewardToken: MockToken;
  let zkKYCContract: ZkKYC;
  let zkKYCVerifier: ZkKYCVerifier;
  let mockZkCertificateRegistry: MockZkCertificateRegistry;
  let mockGalacticaInstitutions: MockGalacticaInstitution[];
  let GalaSBT: GalacticaOfficialSBT;
  let GalaSBT2: GalacticaOfficialSBT;
  const amountInstitutions = 3;

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
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

    [deployer, user, randomUser, client] = await hre.ethers.getSigners();

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

    const zkKYCVerifierFactory = await ethers.getContractFactory(
      'ZkKYCVerifier',
      deployer,
    );
    zkKYCVerifier = (await zkKYCVerifierFactory.deploy()) as ZkKYCVerifier;

    const zkKYCFactory = await ethers.getContractFactory('ZkKYC', deployer);
    zkKYCContract = (await zkKYCFactory.deploy(
      deployer.address,
      zkKYCVerifier.address,
      mockZkCertificateRegistry.address,
      [],
    )) as ZkKYC;


    // set up airdropGateway and set up the client
    const airdropGatewayFactory = await ethers.getContractFactory(
      'AirdropGateway',
      deployer,
    );
    airdropGateway = (await airdropGatewayFactory.deploy(
      deployer.address,
      zkKYCContract.address,
    )) as AirdropGateway;
    clientRole = await airdropGateway.CLIENT_ROLE();
    defaultAdminRole = await airdropGateway.DEFAULT_ADMIN_ROLE();

    // make zkKYC record for airdropGateway
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(
      zkKYC,
      0,
      airdropGateway.address,
    );

    // the same zkKYC but through a different address
    sampleInput2 = await generateZkKYCProofInput(
      zkKYC,
      0,
      airdropGateway.address,
      32,
      null,
      randomUser,
      null
    );

    // get signer object authorized to use the zkKYC record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    circuitWasmPath = './circuits/build/zkKYC.wasm';
    circuitZkeyPath = './circuits/build/zkKYC.zkey';

    // set up requirement SBT contracts
    const galacticaOfficialSBTFactory = await ethers.getContractFactory(
      'GalacticaOfficialSBT',
      deployer,
    );
    GalaSBT = (await galacticaOfficialSBTFactory.deploy(
      deployer.address,
      '',
      deployer.address,
      '',
      '',
    )) as GalacticaOfficialSBT;
    GalaSBT2 = (await galacticaOfficialSBTFactory.deploy(
      deployer.address,
      '',
      deployer.address,
      '',
      '',
    )) as GalacticaOfficialSBT;

    const tokenFactory = await ethers.getContractFactory('MockToken', deployer);
    rewardToken = (await tokenFactory.deploy(deployer.address)) as MockToken;

  });

  it('only owner can whitelist or dewhitelist clients', async () => {
    // random user cannot whitelist
    await expect(
      airdropGateway.connect(randomUser).whitelistClient(client.address),
    ).to.be.revertedWith(
      `AccessControl: account ${randomUser.address.toLowerCase()} is missing role ${defaultAdminRole}`,
    );

    expect(
      await airdropGateway.hasRole(clientRole, client.address),
    ).to.be.equal(false);

    // owner can whitelist
    await airdropGateway.connect(deployer).whitelistClient(client.address);
    expect(
      await airdropGateway.hasRole(clientRole, client.address),
    ).to.be.equal(true);

    // owner can dewhitelist
    await airdropGateway.connect(deployer).dewhitelistClient(client.address);
    expect(
      await airdropGateway.hasRole(clientRole, client.address),
    ).to.be.equal(false);
  });

  it('only clients can set up new distributions', async () => {
    // distribution parameters
    const requiredSBTs = [GalaSBT.address, GalaSBT2.address];
    // we test some error cases first
    const registrationStartTime = 100;
    let registrationEndTime = 50;
    let claimStartTime = 20;
    let claimEndTime = 10;

    // client hasn't been whitelisted yet
    await expect(
      airdropGateway
        .connect(client)
        .setDistribution(
          requiredSBTs,
          rewardToken.address,
          registrationStartTime,
          registrationEndTime,
          claimStartTime,
          claimEndTime,
        ),
    ).to.be.revertedWith(
      `AccessControl: account ${client.address.toLowerCase()} is missing role ${clientRole}`,
    );

    // whitelist client
    await airdropGateway.connect(deployer).whitelistClient(client.address);

    // invalid registration time
    await expect(
      airdropGateway
        .connect(client)
        .setDistribution(
          requiredSBTs,
          rewardToken.address,
          registrationStartTime,
          registrationEndTime,
          claimStartTime,
          claimEndTime,
        ),
    ).to.be.revertedWith(`invalid registration time`);

    registrationEndTime = registrationStartTime + 10;

    // invalid claim start time
    await expect(
      airdropGateway
        .connect(client)
        .setDistribution(
          requiredSBTs,
          rewardToken.address,
          registrationStartTime,
          registrationEndTime,
          claimStartTime,
          claimEndTime,
        ),
    ).to.be.revertedWith(`claim can only start after registration ends`);

    claimStartTime = registrationEndTime + 10;

    // invalid claim time
    await expect(
      airdropGateway
        .connect(client)
        .setDistribution(
          requiredSBTs,
          rewardToken.address,
          registrationStartTime,
          registrationEndTime,
          claimStartTime,
          claimEndTime,
        ),
    ).to.be.revertedWith(`invalid claim time`);

    claimEndTime = claimStartTime + 10;
    const currentDistributionIndex =
      await airdropGateway.distributionIndexCounter();
    // set distribution and check event emission
    await expect(
      airdropGateway
        .connect(client)
        .setDistribution(
          requiredSBTs,
          rewardToken.address,
          registrationStartTime,
          registrationEndTime,
          claimStartTime,
          claimEndTime,
        ),
    )
      .to.emit(airdropGateway, 'DistributionCreated')
      .withArgs(currentDistributionIndex, client.address);

    // check that the distribution parameters are set correctly
    expect(await airdropGateway.distributionIndexCounter()).to.be.equal(
      currentDistributionIndex + 1,
    );
    const onchainDistribution = await airdropGateway.distributions(
      currentDistributionIndex,
    );
    const onchainRequiredSBTs = await airdropGateway.getRequiredSBTs(
      currentDistributionIndex,
    );

    expect(onchainRequiredSBTs[0]).to.be.equal(requiredSBTs[0]);
    expect(onchainRequiredSBTs[1]).to.be.equal(requiredSBTs[1]);
    expect(onchainDistribution.registrationStartTime).to.be.equal(
      registrationStartTime,
    );
    expect(onchainDistribution.registrationEndTime).to.be.equal(
      registrationEndTime,
    );
    expect(onchainDistribution.claimStartTime).to.be.equal(claimStartTime);
    expect(onchainDistribution.claimEndTime).to.be.equal(claimEndTime);
    expect(onchainDistribution.clientAddress).to.be.equal(client.address);
    expect(onchainDistribution.tokenAddress).to.be.equal(rewardToken.address);
    expect(onchainDistribution.distributionAmount).to.be.equal(0);
    expect(onchainDistribution.registeredUserCount).to.be.equal(0);
    expect(onchainDistribution.tokenAmountPerUser).to.be.equal(0);
    expect(onchainDistribution.amountClaimed).to.be.equal(0);
  });


  it.only('eligible users can register and claim airdrop', async () => {
    // distribution parameters
    const requiredSBTs = [GalaSBT.address, GalaSBT2.address];

    // retrieve the block time
    let { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );


    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);

    const publicRoot = publicSignals[await zkKYCContract.INDEX_ROOT()];

    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    const publicTime = parseInt(
      publicSignals[await zkKYCContract.INDEX_CURRENT_TIME()],
      10,
    );

    const registrationStartTime = publicTime + 10;
    const registrationEndTime = registrationStartTime + 10000;
    const claimStartTime = registrationEndTime + 10000;
    const claimEndTime = claimStartTime + 10000;

    // set up the distribution
    await airdropGateway.connect(deployer).whitelistClient(client.address);

    await airdropGateway.connect(client).setDistribution(
      requiredSBTs,
      rewardToken.address,
      registrationStartTime,
      registrationEndTime,
      claimStartTime,
      claimEndTime,
    );

    // user cannot register before registration starts
    let lastBlock = await hre.ethers.provider.getBlock("latest");
    let lastBlockTime = lastBlock.timestamp;

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');
    await expect(
      airdropGateway.connect(user).register(0, piA, piB, piC, publicInputs),
    ).to.be.revertedWith(`registration has not started yet`);

    // set time to the registration start time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [registrationStartTime]);
    await hre.network.provider.send('evm_mine');

    // user still doesn't have required SBTs
    await expect(
      airdropGateway.connect(user).register(0, piA, piB, piC, publicInputs),
    ).to.be.revertedWith(`user does not have required SBT`);

    // we mint the first SBT for the user, but it is not enough
    await GalaSBT.connect(deployer).mint(user.address);
    await expect(
      airdropGateway.connect(user).register(0, piA, piB, piC, publicInputs),
    ).to.be.revertedWith(`user does not have required SBT`);

    // we mint the second SBT for the user, and it is enough
    await GalaSBT2.connect(deployer).mint(user.address);
    await expect(airdropGateway.connect(user).register(0, piA, piB, piC, publicInputs)).to.emit(airdropGateway, 'UserRegistered').withArgs(0, user.address);

    // user cannot register again with the same zkKYC
    // there are some weird issues deconstructing the output
    let outputs = await groth16.fullProve(
      sampleInput2,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const [piA2, piB2, piC2] = processProof(outputs.proof);

    const publicInputs2 = processPublicSignals(outputs.publicSignals);
    await expect(
      airdropGateway.connect(randomUser).register(0, piA2, piB2, piC2, publicInputs2),
    ).to.be.revertedWith(`user has already registered`);

    // we check that parameters are set correctly
    const humanID = publicInputs2[await zkKYCContract.INDEX_HUMAN_ID()];
    expect(await airdropGateway.registeredUsers(0, user.address)).to.be.equal(true);
    expect(await airdropGateway.registeredHumanID(0, humanID)).to.be.equal(true);
    expect((await airdropGateway.distributions(0)).registeredUserCount).to.be.equal(1);

    // client needs to deposit airdrop token
    const airdropAmount = ethers.utils.parseEther('100');
    await rewardToken.connect(deployer).transfer(client.address, airdropAmount);
    //check that only client can deposit
    await expect(
      airdropGateway.connect(deployer).deposit(airdropAmount),
    ).to.be.revertedWith(`only client can deposit`);
    await airdropGateway.connect(client).deposit(airdropAmount);
    expect((await airdropGateway.distributions(0)).distributionAmount).to.be.equal(airdropAmount);

    // user cannot claim too early
    await expect(
      airdropGateway.connect(user).claim(0),
    ).to.be.revertedWith(`claim has not started yet`);
  });

  it('check that the distribution calculation is correct', async () => {
    // distribution parameters
    const requiredSBTs = [GalaSBT.address, GalaSBT2.address];

    // retrieve the block time
    let { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );


    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);

    const publicRoot = publicSignals[await zkKYCContract.INDEX_ROOT()];

    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    const publicTime = parseInt(
      publicSignals[await zkKYCContract.INDEX_CURRENT_TIME()],
      10,
    );

    const registrationStartTime = publicTime + 10;
    const registrationEndTime = registrationStartTime + 10000;
    const claimStartTime = registrationEndTime + 10000;
    const claimEndTime = claimStartTime + 10000;

    // set up the distribution
    await airdropGateway.connect(deployer).whitelistClient(client.address);

    await airdropGateway.connect(client).setDistribution(
      requiredSBTs,
      rewardToken.address,
      registrationStartTime,
      registrationEndTime,
      claimStartTime,
      claimEndTime,
    );

    // user cannot register before registration starts
    let lastBlock = await hre.ethers.provider.getBlock("latest");
    let lastBlockTime = lastBlock.timestamp;

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');
    await expect(
      airdropGateway.connect(user).register(0, piA, piB, piC, publicInputs),
    ).to.be.revertedWith(`registration has not started yet`);

    // set time to the registration start time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [registrationStartTime]);
    await hre.network.provider.send('evm_mine');

    // user still doesn't have required SBTs
    await expect(
      airdropGateway.connect(user).register(0, piA, piB, piC, publicInputs),
    ).to.be.revertedWith(`user does not have required SBT`);

    // we mint the first SBT for the user, but it is not enough
    await GalaSBT.connect(deployer).mint(user.address);
    await expect(
      airdropGateway.connect(user).register(0, piA, piB, piC, publicInputs),
    ).to.be.revertedWith(`user does not have required SBT`);

    // we mint the second SBT for the user, and it is enough
    await GalaSBT2.connect(deployer).mint(user.address);
    await expect(airdropGateway.connect(user).register(0, piA, piB, piC, publicInputs)).to.emit(airdropGateway, 'UserRegistered').withArgs(0, user.address);

    // user cannot register again with the same zkKYC
    // there are some weird issues deconstructing the output
    let outputs = await groth16.fullProve(
      sampleInput2,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const [piA2, piB2, piC2] = processProof(outputs.proof);

    const publicInputs2 = processPublicSignals(outputs.publicSignals);
    await expect(
      airdropGateway.connect(randomUser).register(0, piA2, piB2, piC2, publicInputs2),
    ).to.be.revertedWith(`user has already registered`);

    // we check that parameters are set correctly
    const humanID = publicInputs2[await zkKYCContract.INDEX_HUMAN_ID()];
    expect(await airdropGateway.registeredUsers(0, user.address)).to.be.equal(true);
    expect(await airdropGateway.registeredHumanID(0, humanID)).to.be.equal(true);
    expect((await airdropGateway.distributions(0)).registeredUserCount).to.be.equal(1);

    // client needs to deposit airdrop token
    const airdropAmount = ethers.utils.parseEther('1000000');
    await rewardToken.connect(deployer).transfer(client.address, airdropAmount);
    //check that only client can deposit
    await expect(
      airdropGateway.connect(deployer).deposit(airdropAmount),
    ).to.be.revertedWith(`only client can deposit`);
    await airdropGateway.connect(client).deposit(airdropAmount);
    expect((await airdropGateway.distributions(0)).distributionAmount).to.be.equal(airdropAmount);

    // user cannot claim too early
    await expect(
      airdropGateway.connect(user).claim(0),
    ).to.be.revertedWith(`claim has not started yet`);
  });
});
