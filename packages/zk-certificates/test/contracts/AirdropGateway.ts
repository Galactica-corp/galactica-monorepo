/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import chai from 'chai';
import hre, { ethers } from 'hardhat';
import { groth16 } from 'snarkjs';

import {
  fromDecToHex,
  fromHexToBytes32,
  processProof,
  processPublicSignals,
} from '../../lib/helpers';
import {
  generateSampleZkKYC,
  generateZkKYCProofInput,
} from '../../scripts/dev/generateZkKYCInput';
import type { GuardianRegistry } from '../../typechain-types';
import type { AirdropGateway } from '../../typechain-types/contracts/dapps/AirdropGateway';
import type { MockGalacticaInstitution } from '../../typechain-types/contracts/mock/MockGalacticaInstitution';
import type { MockToken } from '../../typechain-types/contracts/mock/MockToken';
import type { MockZkCertificateRegistry } from '../../typechain-types/contracts/mock/MockZkCertificateRegistry';
import type { GalacticaOfficialSBT } from '../../typechain-types/contracts/SBT_related/GalacticaOfficialSBT';
import type { ZkKYC } from '../../typechain-types/contracts/verifierWrappers/ZkKYC';
import type { ZkKYCVerifier } from '../../typechain-types/contracts/zkpVerifiers/ZkKYCVerifier';

chai.config.includeStack = true;

const { expect } = chai;

describe('AirdropGateway', () => {
  const amountInstitutions = 3;

  /**
   * Unittest fixture for fast tests.
   * @returns Fixture with smart contracts and accounts.
   */
  async function deployFixture() {
    // reset the testing chain so we can perform time related tests
    await hre.network.provider.send('hardhat_reset');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [deployer, _, user2, randomUser, client] =
      await hre.ethers.getSigners();

    // set up KYCRegistry, GalacticaInstitution, ZkKYCVerifier, ZkKYC
    const mockZkCertificateRegistry = (await ethers.deployContract(
      'MockZkCertificateRegistry',
    )) as MockZkCertificateRegistry;

    const mockGalacticaInstitutions = [];
    for (let i = 0; i < amountInstitutions; i++) {
      mockGalacticaInstitutions.push(
        (await ethers.deployContract(
          'MockGalacticaInstitution',
        )) as MockGalacticaInstitution,
      );
    }

    const zkKYCVerifier = (await ethers.deployContract(
      'ZkKYCVerifier',
    )) as ZkKYCVerifier;

    const zkKYCContract = (await ethers.deployContract('ZkKYC', [
      deployer.address,
      await zkKYCVerifier.getAddress(),
      await mockZkCertificateRegistry.getAddress(),
      [],
    ])) as ZkKYC;

    // set up airdropGateway and set up the client
    const airdropGateway = await ethers.deployContract('AirdropGateway', [
      deployer.address,
      await zkKYCContract.getAddress(),
    ]);
    const clientRole = await airdropGateway.CLIENT_ROLE();
    const defaultAdminRole = await airdropGateway.DEFAULT_ADMIN_ROLE();

    // make zkKYC record for airdropGateway
    const zkKYC = await generateSampleZkKYC();
    const sampleInput = await generateZkKYCProofInput(
      zkKYC,
      0,
      await airdropGateway.getAddress(),
    );

    // the same zkKYC but through a different address
    const sampleInput2 = await generateZkKYCProofInput(
      zkKYC,
      0,
      await airdropGateway.getAddress(),
      32,
      null,
      randomUser,
      null,
    );

    // get signer object authorized to use the zkKYC record
    const user = await hre.ethers.getImpersonatedSigner(
      sampleInput.userAddress,
    );

    const circuitWasmPath = './circuits/build/zkKYC.wasm';
    const circuitZkeyPath = './circuits/build/zkKYC.zkey';

    // set up requirement SBT contracts
    const GalaSBT = (await ethers.deployContract('GalacticaOfficialSBT', [
      deployer.address,
      '',
      deployer.address,
      '',
      '',
    ])) as GalacticaOfficialSBT;
    const GalaSBT2 = (await ethers.deployContract('GalacticaOfficialSBT', [
      deployer.address,
      '',
      deployer.address,
      '',
      '',
    ])) as GalacticaOfficialSBT;

    const rewardToken = (await ethers.deployContract('MockToken', [
      deployer.address,
    ])) as MockToken;

    // Deploy GuardianRegistry
    const guardianRegistry = (await ethers.deployContract('GuardianRegistry', [
      'https://example.com/metadata',
    ])) as GuardianRegistry;
    await guardianRegistry.waitForDeployment();

    // Set GuardianRegistry in MockZkCertificateRegistry
    await mockZkCertificateRegistry.setGuardianRegistry(
      await guardianRegistry.getAddress(),
    );

    // Grant guardian role to owner
    const { providerData } = zkKYC;
    await guardianRegistry.grantGuardianRole(
      deployer.address,
      [providerData.ax, providerData.ay],
      'https://example.com/guardian-metadata',
    );

    return {
      deployer,
      user,
      user2,
      randomUser,
      zkKYC,
      client,
      clientRole,
      defaultAdminRole,
      sampleInput,
      sampleInput2,
      guardianRegistry,
      airdropGateway,
      rewardToken,
      zkKYCContract,
      zkKYCVerifier,
      mockZkCertificateRegistry,
      mockGalacticaInstitutions,
      GalaSBT,
      GalaSBT2,
      circuitWasmPath,
      circuitZkeyPath,
    };
  }

  it('only owner can whitelist or dewhitelist clients', async () => {
    const { airdropGateway, randomUser, clientRole, client } =
      await deployFixture();
    // random user cannot whitelist
    await expect(
      airdropGateway
        .connect(randomUser)
        .whitelistClient(await client.getAddress()),
    ).to.be.revertedWithCustomError(
      airdropGateway,
      'AccessControlUnauthorizedAccount',
    );

    expect(
      await airdropGateway.hasRole(clientRole, client.address),
    ).to.be.equal(false);

    // owner can whitelist
    await airdropGateway.whitelistClient(client.address);
    expect(
      await airdropGateway.hasRole(clientRole, client.address),
    ).to.be.equal(true);

    // owner can dewhitelist
    await airdropGateway.dewhitelistClient(client.address);
    expect(
      await airdropGateway.hasRole(clientRole, client.address),
    ).to.be.equal(false);
  });

  it('only clients can set up new distributions', async () => {
    const { airdropGateway, client, GalaSBT, GalaSBT2, rewardToken } =
      await deployFixture();
    // distribution parameters
    const requiredSBTs = [
      await GalaSBT.getAddress(),
      await GalaSBT2.getAddress(),
    ];
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
          await rewardToken.getAddress(),
          registrationStartTime,
          registrationEndTime,
          claimStartTime,
          claimEndTime,
        ),
    ).to.be.revertedWithCustomError(
      airdropGateway,
      'AccessControlUnauthorizedAccount',
    );

    // whitelist client
    await airdropGateway.whitelistClient(client.address);

    // invalid registration time
    await expect(
      airdropGateway
        .connect(client)
        .setDistribution(
          requiredSBTs,
          await rewardToken.getAddress(),
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
          await rewardToken.getAddress(),
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
          await rewardToken.getAddress(),
          registrationStartTime,
          registrationEndTime,
          claimStartTime,
          claimEndTime,
        ),
    ).to.be.revertedWith(`invalid claim time`);

    claimEndTime = claimStartTime + 10;
    // set distribution and check event emission
    await expect(
      airdropGateway
        .connect(client)
        .setDistribution(
          requiredSBTs,
          await rewardToken.getAddress(),
          registrationStartTime,
          registrationEndTime,
          claimStartTime,
          claimEndTime,
        ),
    )
      .to.emit(airdropGateway, 'DistributionCreated')
      .withArgs(client.address);

    // check that the distribution parameters are set correctly
    const onchainDistribution = await airdropGateway.currentDistribution();
    const onchainRequiredSBTs = await airdropGateway.getRequiredSBTs();

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
    expect(onchainDistribution.tokenAddress).to.be.equal(
      await rewardToken.getAddress(),
    );
    expect(onchainDistribution.distributionAmount).to.be.equal(0);
    expect(onchainDistribution.registeredUserCount).to.be.equal(0);
    expect(onchainDistribution.tokenAmountPerUser).to.be.equal(0);
    expect(onchainDistribution.amountClaimed).to.be.equal(0);
  });

  it('eligible users can register and claim airdrop', async () => {
    const {
      airdropGateway,
      randomUser,
      client,
      user,
      GalaSBT,
      GalaSBT2,
      rewardToken,
      zkKYCContract,
      mockZkCertificateRegistry,
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
      sampleInput2,
    } = await deployFixture();
    // retrieve the block time
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);

    const publicRoot = publicSignals[Number(await zkKYCContract.INDEX_ROOT())];

    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    const publicTime = parseInt(
      publicSignals[Number(await zkKYCContract.INDEX_CURRENT_TIME())],
      10,
    );

    // distribution parameters
    const requiredSBTs = [
      await GalaSBT.getAddress(),
      await GalaSBT2.getAddress(),
    ];
    const registrationStartTime = publicTime + 100;
    const registrationEndTime = registrationStartTime + 10000;
    const claimStartTime = registrationEndTime + 10000;
    const claimEndTime = claimStartTime + 10000;

    // set up the distribution
    await airdropGateway.whitelistClient(client.address);

    await airdropGateway
      .connect(client)
      .setDistribution(
        requiredSBTs,
        await rewardToken.getAddress(),
        registrationStartTime,
        registrationEndTime,
        claimStartTime,
        claimEndTime,
      );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');
    await expect(
      airdropGateway.connect(user).register(piA, piB, piC, publicInputs),
    ).to.be.revertedWith(`registration has not started yet`);

    // set time to the registration start time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      registrationStartTime,
    ]);
    await hre.network.provider.send('evm_mine');

    // user still doesn't have required SBTs
    await expect(
      airdropGateway.connect(user).register(piA, piB, piC, publicInputs),
    ).to.be.revertedWith(`user does not have required SBT`);

    // we mint the first SBT for the user, but it is not enough
    await GalaSBT.mint(user.address);
    await expect(
      airdropGateway.connect(user).register(piA, piB, piC, publicInputs),
    ).to.be.revertedWith(`user does not have required SBT`);

    // we mint the second SBT for the user, and it is enough
    await GalaSBT2.mint(user.address);
    await expect(
      airdropGateway.connect(user).register(piA, piB, piC, publicInputs),
    )
      .to.emit(airdropGateway, 'UserRegistered')
      .withArgs(user.address);

    // user cannot register again with the same zkKYC
    // there are some weird issues deconstructing the output
    const outputs = await groth16.fullProve(
      sampleInput2,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const [piA2, piB2, piC2] = processProof(outputs.proof);

    const publicInputs2 = processPublicSignals(outputs.publicSignals);
    await expect(
      airdropGateway
        .connect(randomUser)
        .register(piA2, piB2, piC2, publicInputs2),
    ).to.be.revertedWith(`user has already registered`);

    // we check that parameters are set correctly
    const humanID = publicInputs2[Number(await zkKYCContract.INDEX_HUMAN_ID())];
    expect(await airdropGateway.registeredUsers(user.address)).to.be.equal(
      true,
    );
    expect(await airdropGateway.registeredHumanID(humanID)).to.be.equal(true);
    expect(
      (await airdropGateway.currentDistribution()).registeredUserCount,
    ).to.be.equal(1);
  });

  it('check that the distribution calculation is correct', async () => {
    const {
      deployer,
      GalaSBT,
      GalaSBT2,
      rewardToken,
      zkKYCContract,
      zkKYC,
      circuitWasmPath,
      circuitZkeyPath,
      client,
      user,
      user2,
      randomUser,
    } = await deployFixture();
    // set up a zkKYC contract that always return true
    const MockZkKYCFactory = await hre.ethers.getContractFactory('MockZkKYC');
    const mockZkKYC = await MockZkKYCFactory.deploy();
    await mockZkKYC.waitForDeployment();

    const airdropGateway = (await ethers.deployContract('AirdropGateway', [
      deployer.address,
      await mockZkKYC.getAddress(),
    ])) as AirdropGateway;

    // distribution parameters
    const requiredSBTs = [
      await GalaSBT.getAddress(),
      await GalaSBT2.getAddress(),
    ];

    const sampleInput = await generateZkKYCProofInput(
      zkKYC,
      0,
      await airdropGateway.getAddress(),
    );

    // retrieve the block time
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);

    const userHumanID =
      publicInputs[Number(await zkKYCContract.INDEX_HUMAN_ID())];
    // make a different humanID
    let user2HumanID = userHumanID;
    let user3HumanID = userHumanID;

    // we want to make sure that the humanIDs are pairwise different
    if (userHumanID.endsWith('0')) {
      user2HumanID = userHumanID.replace(/.$/u, '1');
      user3HumanID = userHumanID.replace(/.$/u, '2');
    } else if (userHumanID.endsWith('1')) {
      user2HumanID = userHumanID.replace(/.$/u, '0');
      user3HumanID = userHumanID.replace(/.$/u, '2');
    } else {
      user2HumanID = userHumanID.replace(/.$/u, '0');
      user3HumanID = userHumanID.replace(/.$/u, '1');
    }

    const publicInputs2 = publicInputs.slice();
    publicInputs2[Number(await zkKYCContract.INDEX_HUMAN_ID())] = user2HumanID;
    const publicInputs3 = publicInputs.slice();
    publicInputs3[Number(await zkKYCContract.INDEX_HUMAN_ID())] = user3HumanID;

    const publicTime = parseInt(
      publicSignals[Number(await zkKYCContract.INDEX_CURRENT_TIME())],
      10,
    );

    const registrationStartTime = publicTime + 10;
    const registrationEndTime = registrationStartTime + 10000;
    const claimStartTime = registrationEndTime + 10000;
    const claimEndTime = claimStartTime + 10000;

    // set up the distribution
    await airdropGateway.whitelistClient(client.address);

    await airdropGateway
      .connect(client)
      .setDistribution(
        requiredSBTs,
        await rewardToken.getAddress(),
        registrationStartTime,
        registrationEndTime,
        claimStartTime,
        claimEndTime,
      );

    // we mint SBTs for both users
    await GalaSBT.mint(user.address);
    await GalaSBT2.mint(user.address);
    await GalaSBT.mint(user2.address);
    await GalaSBT2.mint(user2.address);
    await GalaSBT.mint(randomUser.address);
    await GalaSBT2.mint(randomUser.address);

    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      registrationStartTime,
    ]);
    await hre.network.provider.send('evm_mine');

    await expect(
      airdropGateway.connect(user).register(piA, piB, piC, publicInputs),
    )
      .to.emit(airdropGateway, 'UserRegistered')
      .withArgs(user.address);
    await expect(
      airdropGateway.connect(user2).register(piA, piB, piC, publicInputs2),
    )
      .to.emit(airdropGateway, 'UserRegistered')
      .withArgs(user2.address);
    await expect(
      airdropGateway.connect(randomUser).register(piA, piB, piC, publicInputs3),
    )
      .to.emit(airdropGateway, 'UserRegistered')
      .withArgs(randomUser.address);

    // check that the number of registred users is updated correctly
    expect(
      (await airdropGateway.currentDistribution()).registeredUserCount,
    ).to.be.equal(3);

    // client needs to deposit airdrop token
    const airdropAmount = ethers.parseEther('10');
    await rewardToken.transfer(client.address, airdropAmount * BigInt(3));
    await rewardToken.approve(await airdropGateway.getAddress(), airdropAmount);
    await rewardToken
      .connect(client)
      .approve(await airdropGateway.getAddress(), airdropAmount);
    // check that only client can deposit
    await expect(
      airdropGateway.deposit(airdropAmount),
    ).to.be.revertedWithCustomError(
      airdropGateway,
      'AccessControlUnauthorizedAccount',
    );
    await airdropGateway.connect(client).deposit(airdropAmount);
    expect(
      (await airdropGateway.currentDistribution()).distributionAmount,
    ).to.be.equal(airdropAmount);
    expect(
      await rewardToken.balanceOf(await airdropGateway.getAddress()),
    ).to.be.equal(airdropAmount);

    // we check that users cannot claim ahead of time
    await expect(airdropGateway.connect(user).claim()).to.be.revertedWith(
      `claim has not started yet`,
    );

    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      claimStartTime,
    ]);
    await hre.network.provider.send('evm_mine');

    // check that client cannot deposit anymore
    await rewardToken.approve(
      await airdropGateway.connect(client).getAddress(),
      airdropAmount,
    );
    await expect(
      airdropGateway.connect(client).deposit(airdropAmount),
    ).to.be.revertedWith(`claim has already started`);

    // we check that tokenAmountPerUser is initiallly still 0
    expect(
      (await airdropGateway.currentDistribution()).tokenAmountPerUser,
    ).to.be.equal(0);

    // we let users claim
    const expectedTokenAmountPerUser = airdropAmount / BigInt(3);
    await expect(airdropGateway.connect(user).claim())
      .to.emit(airdropGateway, 'UserClaimed')
      .withArgs(user.address, expectedTokenAmountPerUser);
    // we check that the tokenAmountPerUser has been updated after first claim
    expect(
      (await airdropGateway.currentDistribution()).tokenAmountPerUser,
    ).to.be.equal(expectedTokenAmountPerUser);
    // we check other infos as well
    expect(
      (await airdropGateway.currentDistribution()).amountClaimed,
    ).to.be.equal(expectedTokenAmountPerUser);
    // we check that user 1 indeed has his tokens
    expect(await rewardToken.balanceOf(user.address)).to.be.equal(
      expectedTokenAmountPerUser,
    );
    expect(await airdropGateway.claimedUsers(user.address)).to.be.equal(true);

    await expect(airdropGateway.connect(user2).claim())
      .to.emit(airdropGateway, 'UserClaimed')
      .withArgs(user2.address, expectedTokenAmountPerUser);
    expect(
      (await airdropGateway.currentDistribution()).amountClaimed,
    ).to.be.equal(expectedTokenAmountPerUser * BigInt(2));
    expect(await rewardToken.balanceOf(user2.address)).to.be.equal(
      expectedTokenAmountPerUser,
    );

    // we check that user cannot claim twice
    await expect(airdropGateway.connect(user).claim()).to.be.revertedWith(
      `user has already claimed`,
    );

    // we check that client cannot withdraw after the claim
    await expect(
      airdropGateway.connect(client).withdrawRemainingToken(),
    ).to.be.revertedWith(`claim has not ended yet`);

    // set the claim time to end
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      claimEndTime,
    ]);
    await hre.network.provider.send('evm_mine');

    // user cannot claim anymore
    await expect(airdropGateway.connect(randomUser).claim()).to.be.revertedWith(
      `claim has ended`,
    );
    const balanceBefore = await rewardToken.balanceOf(client.address);
    await airdropGateway.connect(client).withdrawRemainingToken();
    const balanceAfter = await rewardToken.balanceOf(client.address);
    const expectedAmountToWithdraw =
      (await airdropGateway.currentDistribution()).distributionAmount -
      (await airdropGateway.currentDistribution()).amountClaimed;
    expect(balanceAfter - balanceBefore).to.be.equal(expectedAmountToWithdraw);
  });
});
