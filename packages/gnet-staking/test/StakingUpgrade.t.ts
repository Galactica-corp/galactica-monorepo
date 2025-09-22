import {
  time,
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre, { ethers, ignition } from 'hardhat';

import testStakingUpgradeModule from '../ignition/modules/test/TestStakingUpgrade.m';
import type { TestStakingUpgrade } from '../typechain-types/contracts/staking/test/TestStakingUpgrade';

type EmissionPeriod = {
  endTime: number;
  rewardPerSecond: bigint;
};

describe('Upgrade Staking', function () {
  const unstakingFeeRatio = 400n;
  const emissionStart = 5;
  const firstCheckPoint = 10;
  const rewardPerSecond = ethers.parseEther('0.42');

  /**
   * Deploy the staking contract with the given parameters.
   *
   * @returns Objects to run tests on.
   */
  async function deployFixture() {
    const [owner, staker, staker2, otherAccount] =
      await hre.ethers.getSigners();

    const { upgradedStaking } = await ignition.deploy(
      testStakingUpgradeModule,
      {
        parameters: {
          StakingModule: {
            unstakingFeeRatio,
            owner: owner.address,
            emissionStart,
            firstCheckPoint,
            rewardPerSecond,
          },
          TimelockControllerModule: {
            // set the timelock duration to 0, so that the upgrade can be executed immediately for the unittest
            minDelay: 0,
          },
          TestStakingUpgradeModule: {
            newVersion: '2.0.0',
          },
        },
      },
    );

    // Fund the staking contract with native tokens for rewards
    const depositedReward = ethers.parseEther('100');
    await owner.sendTransaction({
      to: await upgradedStaking.getAddress(),
      value: depositedReward,
    });

    return {
      upgradedStaking: upgradedStaking as unknown as TestStakingUpgrade,
      owner,
      staker,
      staker2,
      otherAccount,
      depositedReward,
    };
  }

  describe('Deployment', function () {
    it('Should keep previous parameters', async function () {
      const { upgradedStaking, owner } = await loadFixture(deployFixture);

      expect(await upgradedStaking.unstakingFeeRatio()).to.equal(
        unstakingFeeRatio,
      );
      expect(await upgradedStaking.checkPoints(0)).to.equal(emissionStart);
      expect(await upgradedStaking.checkPoints(1)).to.equal(firstCheckPoint);
      expect(await upgradedStaking.rewardPerSecond(0)).to.equal(
        rewardPerSecond,
      );
      expect(await upgradedStaking.owner()).to.equal(owner.address);
    });

    it('Should add new version field', async function () {
      const { upgradedStaking } = await loadFixture(deployFixture);

      expect(await upgradedStaking.version()).to.equal('2.0.0');
    });
  });

  describe('Should work as before', function () {
    it('Should reward staking with multiple users and emission periods', async function () {
      const { upgradedStaking, staker, staker2, depositedReward } =
        await loadFixture(deployFixture);

      const start = await time.latest();
      const emissionPeriods: EmissionPeriod[] = [
        {
          endTime: start + 1000,
          rewardPerSecond: ethers.parseEther('0.002'),
        },
        {
          endTime: start + 1500,
          rewardPerSecond: ethers.parseEther('0.003'),
        },
        {
          endTime: start + 3000,
          rewardPerSecond: ethers.parseEther('0.005'),
        },
        {
          endTime: start + 4444,
          rewardPerSecond: ethers.parseEther('0.007'),
        },
      ];
      for (const period of emissionPeriods) {
        await upgradedStaking.updateSchedule(
          period.endTime,
          period.rewardPerSecond,
        );
      }

      let expectedStakesStaker = 0n;
      let expectedStakesStaker2 = 0n;
      let expectedRewardsStaker = 0n;
      let expectedRewardsStaker2 = 0n;
      let feesPaidStaker2 = 0n;
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, start',
      ).to.equal(expectedRewardsStaker);
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, start',
      ).to.equal(expectedRewardsStaker2);

      // first only the owner stakes
      await time.setNextBlockTimestamp(start + 100);
      const tx1 = await upgradedStaking
        .connect(staker)
        .createStake({ value: ethers.parseEther('5') });
      let receipt = await tx1.wait();
      expectedStakesStaker += ethers.parseEther('5');

      // later in the same period the other account stakes
      await time.setNextBlockTimestamp(start + 700);
      const tx2 = await upgradedStaking
        .connect(staker2)
        .createStake({ value: ethers.parseEther('10') });
      receipt = await tx2.wait();
      feesPaidStaker2 += receipt?.fee ?? 0n;
      expectedStakesStaker2 += ethers.parseEther('10');
      let lastUpdateTime = await time.latest();

      expectedRewardsStaker +=
        emissionPeriods[0].rewardPerSecond * BigInt(700 - 100);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, first period',
      ).to.equal(expectedRewardsStaker);
      expect(
        await upgradedStaking.stakes(staker.address),
        'stake staker, first period',
      ).to.equal(expectedStakesStaker);
      expect(
        await upgradedStaking.stakes(staker2.address),
        'stake staker2, first period',
      ).to.equal(expectedStakesStaker2);

      // in the second period the staker increases his stake
      await time.setNextBlockTimestamp(start + 1300);
      const tx3 = await upgradedStaking
        .connect(staker)
        .createStake({ value: ethers.parseEther('10') });
      receipt = await tx3.wait();
      // updating the reward (using the time of the latest block and the stake amount before the increase)
      expectedRewardsStaker +=
        (emissionPeriods[0].rewardPerSecond *
          BigInt(emissionPeriods[0].endTime - lastUpdateTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[1].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[0].endTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2);
      expectedRewardsStaker2 +=
        (emissionPeriods[0].rewardPerSecond *
          BigInt(emissionPeriods[0].endTime - lastUpdateTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[1].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[0].endTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2);
      expectedStakesStaker += ethers.parseEther('10');
      lastUpdateTime = await time.latest();
      expect(
        await upgradedStaking.stakes(staker.address),
        'stake staker, second period',
      ).to.equal(expectedStakesStaker);
      expect(
        await upgradedStaking.stakes(staker2.address),
        'stake staker2, second period',
      ).to.equal(expectedStakesStaker2);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, second period',
      ).to.equal(expectedRewardsStaker);
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, second period',
      ).to.equal(expectedRewardsStaker2);

      // remember maximum total stake for calculating the fee later
      const maximumTotalStake = expectedStakesStaker + expectedStakesStaker2;

      // in the third period the other account withdraws his rewards
      await time.setNextBlockTimestamp(start + 2000);
      const staker2AccountBalanceBeforeReward =
        await ethers.provider.getBalance(staker2.address);
      const tx4 = await upgradedStaking.connect(staker2).getReward();
      receipt = await tx4.wait();
      feesPaidStaker2 += receipt?.fee ?? 0n;
      expectedRewardsStaker +=
        (emissionPeriods[1].rewardPerSecond *
          BigInt(emissionPeriods[1].endTime - lastUpdateTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[2].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[1].endTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2);
      expectedRewardsStaker2 +=
        (emissionPeriods[1].rewardPerSecond *
          BigInt(emissionPeriods[1].endTime - lastUpdateTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[2].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[1].endTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2);

      lastUpdateTime = await time.latest();
      expect(
        await upgradedStaking.stakes(staker.address),
        'stake staker, third period',
      ).to.equal(expectedStakesStaker);
      expect(
        await upgradedStaking.stakes(staker2.address),
        'stake staker2, third period',
      ).to.equal(expectedStakesStaker2);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, third period',
      ).to.be.closeTo(expectedRewardsStaker, 100n);
      expect(
        await ethers.provider.getBalance(staker2.address),
        'balance staker2, third period',
      ).to.be.greaterThan(
        staker2AccountBalanceBeforeReward +
          expectedRewardsStaker2 -
          100n -
          feesPaidStaker2,
      );
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, third period',
      ).to.equal(0); // because the other account withdrew his rewards
      let withdrawnRewards = expectedRewardsStaker2;
      expectedRewardsStaker2 = 0n;

      // in the forth period the staker unstakes half of his tokens
      await time.setNextBlockTimestamp(start + 3500);
      const tx5 = await upgradedStaking
        .connect(staker)
        .removeStake(expectedStakesStaker / 2n, expectedStakesStaker / 2n);
      receipt = await tx5.wait();
      expectedRewardsStaker +=
        (emissionPeriods[2].rewardPerSecond *
          BigInt(emissionPeriods[2].endTime - lastUpdateTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[3].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[2].endTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2);
      expectedRewardsStaker2 +=
        (emissionPeriods[2].rewardPerSecond *
          BigInt(emissionPeriods[2].endTime - lastUpdateTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[3].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[2].endTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2);
      expectedStakesStaker /= 2n;
      lastUpdateTime = await time.latest();
      expect(
        await upgradedStaking.stakes(staker.address),
        'stake staker, fourth period',
      ).to.equal(expectedStakesStaker);
      expect(
        await upgradedStaking.stakes(staker2.address),
        'stake staker2, fourth period',
      ).to.equal(expectedStakesStaker2);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, fourth period',
      ).to.be.closeTo(expectedRewardsStaker, 100n);
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, fourth period',
      ).to.be.closeTo(expectedRewardsStaker2, 100n);

      // in the distant future both accounts withdraw all stake and rewards
      await time.setNextBlockTimestamp(start + 6666);
      const tx6 = await upgradedStaking
        .connect(staker2)
        .removeStake(expectedStakesStaker2, expectedStakesStaker2);
      receipt = await tx6.wait();
      feesPaidStaker2 += receipt?.fee ?? 0n;
      expectedRewardsStaker +=
        (emissionPeriods[3].rewardPerSecond *
          BigInt(emissionPeriods[3].endTime - lastUpdateTime) *
          expectedStakesStaker) /
        (expectedStakesStaker + expectedStakesStaker2);
      expectedRewardsStaker2 +=
        (emissionPeriods[3].rewardPerSecond *
          BigInt(emissionPeriods[3].endTime - lastUpdateTime) *
          expectedStakesStaker2) /
        (expectedStakesStaker + expectedStakesStaker2);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, distant future',
      ).to.be.closeTo(expectedRewardsStaker, 100n);
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, distant future',
      ).to.be.closeTo(expectedRewardsStaker2, 100n);
      await upgradedStaking.connect(staker).getReward();
      const tx7 = await upgradedStaking.connect(staker2).getReward();
      receipt = await tx7.wait();
      feesPaidStaker2 += receipt?.fee ?? 0n;
      await upgradedStaking
        .connect(staker)
        .removeStake(expectedStakesStaker, expectedStakesStaker);
      withdrawnRewards += expectedRewardsStaker + expectedRewardsStaker2;

      expect(
        await upgradedStaking.stakes(staker.address),
        'stake staker, end',
      ).to.equal(0n);
      expect(
        await upgradedStaking.stakes(staker2.address),
        'stake staker2, end',
      ).to.equal(0n);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, end',
      ).to.equal(0n);
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, end',
      ).to.equal(0n);

      // check fee amounts that were paid for unstaking
      const expectedUnstakingFee =
        (maximumTotalStake * unstakingFeeRatio) / 10000n;
      expect(
        await ethers.provider.getBalance(await upgradedStaking.getAddress()),
        'balance of staking contract, end',
      ).to.equal(expectedUnstakingFee + depositedReward - withdrawnRewards);
    });

    it.only('Should reward staking with multiple users and emission periods with WGNET', async function () {
      const { upgradedStaking, staker, staker2, depositedReward } =
        await loadFixture(deployFixture);

      const start = await time.latest();
      const emissionPeriods: EmissionPeriod[] = [
        {
          endTime: start + 1000,
          rewardPerSecond: ethers.parseEther('0.002'),
        },
        {
          endTime: start + 1500,
          rewardPerSecond: ethers.parseEther('0.003'),
        },
        {
          endTime: start + 3000,
          rewardPerSecond: ethers.parseEther('0.005'),
        },
        {
          endTime: start + 4444,
          rewardPerSecond: ethers.parseEther('0.007'),
        },
      ];
      for (const period of emissionPeriods) {
        await upgradedStaking.updateSchedule(
          period.endTime,
          period.rewardPerSecond,
        );
      }

      let expectedStakesStaker = 0n;
      let expectedStakesStaker2 = 0n;
      let expectedRewardsStaker = 0n;
      let expectedRewardsStaker2 = 0n;
      let feesPaidStaker2 = 0n;
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, start',
      ).to.equal(expectedRewardsStaker);
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, start',
      ).to.equal(expectedRewardsStaker2);


      // deploy WGNET
      const wGNETFactory = await hre.ethers.getContractFactory('WGNET10');
      const wGNET = await wGNETFactory.deploy();

      // stakers deposit GNET to get WGNET
      await wGNET.connect(staker).deposit({ value: ethers.parseEther('1000') });
      await wGNET.connect(staker2).deposit({ value: ethers.parseEther('1000') });

      // approve WGNET for the staking contract
      await wGNET.connect(staker).approve(await upgradedStaking.getAddress(), ethers.parseEther('1000'));
      await wGNET.connect(staker2).approve(await upgradedStaking.getAddress(), ethers.parseEther('1000'));

      // set WGNET inside the staking contract
      await upgradedStaking.setWGNET(wGNET.getAddress());``


      // first only the owner stakes
      await time.setNextBlockTimestamp(start + 100);




      const tx1 = await upgradedStaking
        .connect(staker)
        .createStakeWithWGNET(ethers.parseEther('5'));
      let receipt = await tx1.wait();
      expectedStakesStaker += ethers.parseEther('5');

      // later in the same period the other account stakes
      await time.setNextBlockTimestamp(start + 700);
      const tx2 = await upgradedStaking
        .connect(staker2)
        .createStakeWithWGNET(ethers.parseEther('10'));
      receipt = await tx2.wait();
      feesPaidStaker2 += receipt?.fee ?? 0n;
      expectedStakesStaker2 += ethers.parseEther('10');
      let lastUpdateTime = await time.latest();

      expectedRewardsStaker +=
        emissionPeriods[0].rewardPerSecond * BigInt(700 - 100);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, first period',
      ).to.equal(expectedRewardsStaker);
      expect(
        await upgradedStaking.stakes(staker.address),
        'stake staker, first period',
      ).to.equal(expectedStakesStaker);
      expect(
        await upgradedStaking.stakes(staker2.address),
        'stake staker2, first period',
      ).to.equal(expectedStakesStaker2);

      // in the second period the staker increases his stake
      await time.setNextBlockTimestamp(start + 1300);
      const tx3 = await upgradedStaking
        .connect(staker)
        .createStakeWithWGNET(ethers.parseEther('10'));
      receipt = await tx3.wait();
      // updating the reward (using the time of the latest block and the stake amount before the increase)
      expectedRewardsStaker +=
        (emissionPeriods[0].rewardPerSecond *
          BigInt(emissionPeriods[0].endTime - lastUpdateTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[1].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[0].endTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2);
      expectedRewardsStaker2 +=
        (emissionPeriods[0].rewardPerSecond *
          BigInt(emissionPeriods[0].endTime - lastUpdateTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[1].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[0].endTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2);
      expectedStakesStaker += ethers.parseEther('10');
      lastUpdateTime = await time.latest();
      expect(
        await upgradedStaking.stakes(staker.address),
        'stake staker, second period',
      ).to.equal(expectedStakesStaker);
      expect(
        await upgradedStaking.stakes(staker2.address),
        'stake staker2, second period',
      ).to.equal(expectedStakesStaker2);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, second period',
      ).to.equal(expectedRewardsStaker);
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, second period',
      ).to.equal(expectedRewardsStaker2);

      // remember maximum total stake for calculating the fee later
      const maximumTotalStake = expectedStakesStaker + expectedStakesStaker2;

      // in the third period the other account withdraws his rewards
      await time.setNextBlockTimestamp(start + 2000);
      const staker2AccountBalanceBeforeReward =
        await ethers.provider.getBalance(staker2.address);
      const tx4 = await upgradedStaking.connect(staker2).getReward();
      receipt = await tx4.wait();
      feesPaidStaker2 += receipt?.fee ?? 0n;
      expectedRewardsStaker +=
        (emissionPeriods[1].rewardPerSecond *
          BigInt(emissionPeriods[1].endTime - lastUpdateTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[2].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[1].endTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2);
      expectedRewardsStaker2 +=
        (emissionPeriods[1].rewardPerSecond *
          BigInt(emissionPeriods[1].endTime - lastUpdateTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[2].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[1].endTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2);

      lastUpdateTime = await time.latest();
      expect(
        await upgradedStaking.stakes(staker.address),
        'stake staker, third period',
      ).to.equal(expectedStakesStaker);
      expect(
        await upgradedStaking.stakes(staker2.address),
        'stake staker2, third period',
      ).to.equal(expectedStakesStaker2);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, third period',
      ).to.be.closeTo(expectedRewardsStaker, 100n);
      expect(
        await ethers.provider.getBalance(staker2.address),
        'balance staker2, third period',
      ).to.be.greaterThan(
        staker2AccountBalanceBeforeReward +
          expectedRewardsStaker2 -
          100n -
          feesPaidStaker2,
      );
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, third period',
      ).to.equal(0); // because the other account withdrew his rewards
      let withdrawnRewards = expectedRewardsStaker2;
      expectedRewardsStaker2 = 0n;

      // in the forth period the staker unstakes half of his tokens
      await time.setNextBlockTimestamp(start + 3500);
      const tx5 = await upgradedStaking
        .connect(staker)
        .removeStake(expectedStakesStaker / 2n, expectedStakesStaker / 2n);
      receipt = await tx5.wait();
      expectedRewardsStaker +=
        (emissionPeriods[2].rewardPerSecond *
          BigInt(emissionPeriods[2].endTime - lastUpdateTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[3].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[2].endTime) *
          expectedStakesStaker) /
          (expectedStakesStaker + expectedStakesStaker2);
      expectedRewardsStaker2 +=
        (emissionPeriods[2].rewardPerSecond *
          BigInt(emissionPeriods[2].endTime - lastUpdateTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2) +
        (emissionPeriods[3].rewardPerSecond *
          BigInt((await time.latest()) - emissionPeriods[2].endTime) *
          expectedStakesStaker2) /
          (expectedStakesStaker + expectedStakesStaker2);
      expectedStakesStaker /= 2n;
      lastUpdateTime = await time.latest();
      expect(
        await upgradedStaking.stakes(staker.address),
        'stake staker, fourth period',
      ).to.equal(expectedStakesStaker);
      expect(
        await upgradedStaking.stakes(staker2.address),
        'stake staker2, fourth period',
      ).to.equal(expectedStakesStaker2);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, fourth period',
      ).to.be.closeTo(expectedRewardsStaker, 100n);
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, fourth period',
      ).to.be.closeTo(expectedRewardsStaker2, 100n);

      // in the distant future both accounts withdraw all stake and rewards
      await time.setNextBlockTimestamp(start + 6666);
      const tx6 = await upgradedStaking
        .connect(staker2)
        .removeStakeWithWGNET(expectedStakesStaker2, expectedStakesStaker2);
      receipt = await tx6.wait();
      feesPaidStaker2 += receipt?.fee ?? 0n;
      expectedRewardsStaker +=
        (emissionPeriods[3].rewardPerSecond *
          BigInt(emissionPeriods[3].endTime - lastUpdateTime) *
          expectedStakesStaker) /
        (expectedStakesStaker + expectedStakesStaker2);
      expectedRewardsStaker2 +=
        (emissionPeriods[3].rewardPerSecond *
          BigInt(emissionPeriods[3].endTime - lastUpdateTime) *
          expectedStakesStaker2) /
        (expectedStakesStaker + expectedStakesStaker2);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, distant future',
      ).to.be.closeTo(expectedRewardsStaker, 100n);
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, distant future',
      ).to.be.closeTo(expectedRewardsStaker2, 100n);
      await upgradedStaking.connect(staker).getReward();
      const tx7 = await upgradedStaking.connect(staker2).getReward();
      receipt = await tx7.wait();
      feesPaidStaker2 += receipt?.fee ?? 0n;
      await upgradedStaking
        .connect(staker)
        .removeStakeWithWGNET(expectedStakesStaker, expectedStakesStaker);
      withdrawnRewards += expectedRewardsStaker + expectedRewardsStaker2;

      expect(
        await upgradedStaking.stakes(staker.address),
        'stake staker, end',
      ).to.equal(0n);
      expect(
        await upgradedStaking.stakes(staker2.address),
        'stake staker2, end',
      ).to.equal(0n);
      expect(
        await upgradedStaking.showPendingReward(staker.address),
        'pending reward staker, end',
      ).to.equal(0n);
      expect(
        await upgradedStaking.showPendingReward(staker2.address),
        'pending reward staker2, end',
      ).to.equal(0n);

      // check fee amounts that were paid for unstaking
      const expectedUnstakingFee =
        (maximumTotalStake * unstakingFeeRatio) / 10000n;
      expect(
        await ethers.provider.getBalance(await upgradedStaking.getAddress()),
        'balance of staking contract, end',
      ).to.equal(expectedUnstakingFee + depositedReward - withdrawnRewards);
    });
  });
});
