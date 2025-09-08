/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import chai from 'chai';
import type { TransactionResponse } from 'ethers';
import hre, { ethers } from 'hardhat';
import { groth16 } from 'snarkjs';

import {
  fromHexToBytes32,
  processProof,
  processPublicSignals,
} from '../../lib/helpers';
import type { ZkCertificate } from '../../lib/zkCertificate';
import {
  generateSampleZkKYC,
  generateZkKYCProofInput,
} from '../../scripts/dev/generateZkKYCInput';
import type { Faucet } from '../../typechain-types/contracts/dapps/Faucet';
import type { MockGalacticaInstitution } from '../../typechain-types/contracts/mock/MockGalacticaInstitution';
import type { VerificationSBT } from '../../typechain-types/contracts/SBT_related/VerificationSBT';

chai.config.includeStack = true;

const { expect } = chai;

describe('AirdropGateway', () => {
  // reset the testing chain so we can perform time related tests
  /* await hre.network.provider.send('hardhat_reset'); */
  let faucet: Faucet;
  let mockGalacticaInstitutions: MockGalacticaInstitution[];
  const amountInstitutions = 0;
  let verificationSBT: VerificationSBT;
  let epochDuration: number;
  let epochStartTime: number;
  let amountPerEpoch: bigint;

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let zkKYC: ZkCertificate;
  let sampleInput: any, circuitWasmPath: string, circuitZkeyPath: string;

  beforeEach(async () => {
    // reset the testing chain so we can perform time related tests
    await hre.network.provider.send('hardhat_reset');

    [deployer, user, user2] = await hre.ethers.getSigners();

    mockGalacticaInstitutions = [];
    for (let i = 0; i < amountInstitutions; i++) {
      mockGalacticaInstitutions.push(
        await ethers.deployContract('MockGalacticaInstitution'),
      );
    }

    // interaction with zkKYC has been tested in AirdropGateway and BasicKYCExampleDAppTest
    const mockZkKYC = await ethers.deployContract('MockZkKYC');
    await mockZkKYC.waitForDeployment();

    // set up the faucet
    epochDuration = 100;
    epochStartTime =
      (await hre.ethers.provider.getBlock('latest'))?.timestamp ?? 0;
    amountPerEpoch = ethers.parseEther('1');

    faucet = await ethers.deployContract('Faucet', [
      deployer.address,
      epochDuration,
      epochStartTime,
      amountPerEpoch,
      await mockZkKYC.getAddress(),
      'test URI',
      'VerificationSBT',
      'VerificationSBT',
    ]);

    verificationSBT = await ethers.getContractAt(
      'VerificationSBT',
      await faucet.sbt(),
    );

    // make zkKYC record for airdropGateway
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(
      zkKYC,
      0,
      await faucet.getAddress(),
    );

    circuitWasmPath = './circuits/build/zkKYC.wasm';
    circuitZkeyPath = './circuits/build/zkKYC.zkey';
  });

  it('users can claim', async () => {
    // first we send some fund to the contract
    await deployer.sendTransaction({
      to: await faucet.getAddress(),
      value: ethers.parseEther('100'),
    });

    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const [piA, piB, piC] = processProof(proof);

    const humanID1 = fromHexToBytes32(
      Buffer.from(ethers.randomBytes(32)).toString('hex'),
    );

    const HUMAN_ID_INDEX = 0;
    const INDEX_VERIFICATION_EXPIRATION = 4;
    const USER_ADDRESS_INDEX = 7 + amountInstitutions * 2;
    // we set up relevant public info
    publicSignals[HUMAN_ID_INDEX] = humanID1;
    publicSignals[USER_ADDRESS_INDEX] = user.address.toLowerCase();
    publicSignals[INDEX_VERIFICATION_EXPIRATION] =
      epochStartTime + epochDuration * 10;

    const publicInputs = processPublicSignals(publicSignals);

    // now at epoch 2 when we call from any account the claimWithoutSBT for user
    // he should receive 2 epochs worth of funds and an SBT

    // we set the time to epoch 2
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      epochStartTime + epochDuration * 1.5,
    ]);
    await hre.network.provider.send('evm_mine');

    const userBalanceBefore = await ethers.provider.getBalance(user.address);

    await faucet.claimWithoutSBT(piA, piB, piC, publicInputs);

    const userBalanceAfter = await ethers.provider.getBalance(user.address);

    // check that user has received the fund
    // which is one time amount per Epoch, even though two epochs have past
    expect(userBalanceAfter).to.be.equal(userBalanceBefore + amountPerEpoch);
    // check that user has minted a valid SBT
    expect(
      await verificationSBT.isVerificationSBTValid(user.address),
    ).to.be.equal(true);
    // check that humanID has been assigned user address
    expect(await faucet.humanIdToAddress(humanID1)).to.be.equal(user.address);
    // check that humanID has been assigned current epoch index
    expect(await faucet.lastEpochClaimed(humanID1)).to.be.equal(2);
    // view function should return that there is no claimable fund for this humanID
    expect(await faucet.getAmountClaimable(humanID1)).to.be.equal(0);

    // now check that recalling claim function in the same epoch doesn't give user any additional funds
    await faucet.claimWithoutSBT(piA, piB, piC, publicInputs);
    const userBalanceAfter2 = await ethers.provider.getBalance(user.address);
    expect(userBalanceAfter2).to.be.equal(userBalanceAfter);

    // forward time to claim one more epoch
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      epochStartTime + epochDuration * 2.5,
    ]);
    await hre.network.provider.send('evm_mine');
    // now the view function should show one epoch worth of claimable fund
    expect(await faucet.getAmountClaimable(humanID1)).to.be.equal(
      amountPerEpoch,
    );

    await faucet.claimWithoutSBT(piA, piB, piC, publicInputs);
    const userBalanceAfter3 = await ethers.provider.getBalance(user.address);
    expect(userBalanceAfter3).to.be.equal(userBalanceAfter2 + amountPerEpoch);
    expect(await faucet.lastEpochClaimed(humanID1)).to.be.equal(3);

    // forward one more epoch to test claimWithSBT
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      epochStartTime + epochDuration * 3.5,
    ]);
    await hre.network.provider.send('evm_mine');
    const tx = (await faucet
      .connect(user)
      .claimWithSBT()) as TransactionResponse;
    await tx.wait();

    const txReceipt = await ethers.provider.getTransactionReceipt(tx.hash);
    const gasCost =
      (txReceipt?.cumulativeGasUsed ?? BigInt(0)) *
      (txReceipt?.gasPrice ?? BigInt(0));

    const userBalanceAfter4 = await ethers.provider.getBalance(user.address);
    expect(userBalanceAfter4).to.be.equal(
      userBalanceAfter3 + amountPerEpoch - gasCost,
    );
    expect(await faucet.lastEpochClaimed(humanID1)).to.be.equal(4);

    // check that user cannot assign a different address to the same humanID when current SBt is staill valid
    publicInputs[USER_ADDRESS_INDEX] = user2.address.toLowerCase();
    await expect(
      faucet.claimWithoutSBT(piA, piB, piC, publicInputs),
    ).to.be.revertedWith('SBT is still valid for different address.');

    // let's forward to a time when the SBT is no longer valid
    // user can mint a new SBT to a different address
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      publicSignals[INDEX_VERIFICATION_EXPIRATION] + 10,
    ]);
    await hre.network.provider.send('evm_mine');
    // check that user cannot assign a different address to the same humanID when current SBT is staill valid
    publicInputs[USER_ADDRESS_INDEX] = user2.address.toLowerCase();
    const user2BalanceBefore = await ethers.provider.getBalance(user2.address);
    await faucet.claimWithoutSBT(piA, piB, piC, publicInputs);
    const user2BalanceAfter = await ethers.provider.getBalance(user2.address);
    expect(user2BalanceAfter).to.be.equal(user2BalanceBefore + amountPerEpoch);

    // check that humanID has been assigned user address
    expect(await faucet.humanIdToAddress(humanID1)).to.be.equal(user2.address);
    // check that humanID has been assigned current epoch index
    expect(await faucet.lastEpochClaimed(humanID1)).to.be.equal(11);
  });
});
