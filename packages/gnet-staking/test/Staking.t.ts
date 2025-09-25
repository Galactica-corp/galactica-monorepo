import {
  time,
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre, { ethers, ignition } from 'hardhat';

import stakingModule from '../ignition/modules/Staking.m';
import type { Staking } from '../typechain-types/contracts/Staking';

type EmissionPeriod = {
  endTime: number;
  rewardPerSecond: bigint;
};

describe('Staking', function () {
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

    const { staking } = await ignition.deploy(stakingModule, {
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
      },
    });

    // Fund the staking contract with native tokens for rewards
    const depositedReward = ethers.parseEther('100');
    await owner.sendTransaction({
      to: await staking.getAddress(),
      value: depositedReward,
    });

    return {
      staking: staking as unknown as Staking,
      owner,
      staker,
      staker2,
      otherAccount,
      depositedReward,
    };
  }

  describe('Deployment', function () {
    it('Should set the right parameters', async function () {
      const { staking, owner } = await loadFixture(deployFixture);

      expect(await staking.unstakingFeeRatio()).to.equal(unstakingFeeRatio);
      expect(await staking.checkPoints(0)).to.equal(emissionStart);
      expect(await staking.checkPoints(1)).to.equal(firstCheckPoint);
      expect(await staking.rewardPerSecond(0)).to.equal(rewardPerSecond);
      expect(await staking.owner()).to.equal(owner.address);
    });

    it('Should have empty stakes initially', async function () {
      const { staking, owner } = await loadFixture(deployFixture);

      expect(await staking.stakes(owner.address)).to.equal(0);
      expect(await staking.totalStake()).to.equal(0);
    });

    it('Should fail to initialize twice', async function () {
      const { staking, owner } = await loadFixture(deployFixture);

      await expect(
        staking.initialize(
          unstakingFeeRatio,
          owner.address,
          emissionStart,
          firstCheckPoint,
          rewardPerSecond,
        ),
      ).to.be.revertedWithCustomError(staking, 'InvalidInitialization');
    });

    it('Should fail to initialize with invalid zero addresses', async function () {
      await expect(
        ignition.deploy(stakingModule, {
          parameters: {
            StakingModule: {
              unstakingFeeRatio,
              owner: ethers.ZeroAddress,
              emissionStart,
              firstCheckPoint,
              rewardPerSecond,
            },
          },
        }),
      ).to.be.rejectedWith('custom error');
    });
  });

  describe('Staking', function () {
    it('Should stake tokens', async function () {
      const { staking, staker, depositedReward } =
        await loadFixture(deployFixture);

      const stakeAmount = ethers.parseEther('5');
      const initialBalance = await ethers.provider.getBalance(staker.address);

      await staking.connect(staker).createStake({ value: stakeAmount });

      expect(await staking.stakes(staker.address)).to.equal(stakeAmount);
      expect(await staking.totalStake()).to.equal(stakeAmount);
      expect(
        await ethers.provider.getBalance(await staking.getAddress()),
      ).to.equal(stakeAmount + depositedReward);

      // Check owner balance decreased (accounting for gas fees)
      const finalBalance = await ethers.provider.getBalance(staker.address);
      expect(finalBalance).to.be.lessThan(initialBalance - stakeAmount);
    });

    it('Should unstake tokens', async function () {
      const { staking, staker, depositedReward } =
        await loadFixture(deployFixture);

      const stakeAmount = ethers.parseEther('10');

      const tx1 = await staking
        .connect(staker)
        .createStake({ value: stakeAmount });
      let receipt = await tx1.wait();
      let feesPaid = receipt?.fee ?? 0n;

      const unstakingFee = (stakeAmount * unstakingFeeRatio) / 10000n;
      const initialBalanceBeforeUnstake = await ethers.provider.getBalance(
        staker.address,
      );

      const tx2 = await staking
        .connect(staker)
        .removeStake(stakeAmount, unstakingFee);
      receipt = await tx2.wait();
      feesPaid += receipt?.fee ?? 0n;

      expect(await staking.stakes(staker.address)).to.equal(0);
      expect(await staking.totalStake()).to.equal(0);
      expect(
        await ethers.provider.getBalance(await staking.getAddress()),
      ).to.equal(unstakingFee + depositedReward);

      // Check owner balance increased by stake amount minus fee (accounting for gas fees)
      const finalBalance = await ethers.provider.getBalance(staker.address);
      expect(finalBalance).to.be.greaterThan(
        initialBalanceBeforeUnstake + stakeAmount - unstakingFee - feesPaid,
      );
    });

    it('Should not unstake if not enough stake', async function () {
      const { staking, staker } = await loadFixture(deployFixture);

      const stakeAmount = ethers.parseEther('1');
      const unstakeAmount = ethers.parseEther('2');
      const unstakingFee = (unstakeAmount * unstakingFeeRatio) / 10000n;

      await staking.connect(staker).createStake({ value: stakeAmount });

      await expect(
        staking.connect(staker).removeStake(unstakeAmount, unstakingFee),
      ).to.be.revertedWithCustomError(staking, 'InsufficientStake');
    });

    it('Should transfer stake', async function () {
      const { staking, staker, staker2 } = await loadFixture(deployFixture);

      const stakeAmount = ethers.parseEther('10');
      const transferAmount = ethers.parseEther('7');

      await staking.connect(staker).createStake({ value: stakeAmount });

      await staking
        .connect(staker)
        .transferStake(staker2.address, transferAmount);

      expect(await staking.stakes(staker.address)).to.equal(
        stakeAmount - transferAmount,
      );
      expect(await staking.stakes(staker2.address)).to.equal(transferAmount);
    });

    it('Should not transfer stake if not enough stake', async function () {
      const { staking, otherAccount } = await loadFixture(deployFixture);

      const stakeAmount = ethers.parseEther('10');
      const transferAmount = ethers.parseEther('11');

      await staking.connect(otherAccount).createStake({ value: stakeAmount });

      await expect(
        staking
          .connect(otherAccount)
          .transferStake(otherAccount.address, transferAmount),
      ).to.be.revertedWithCustomError(staking, 'InsufficientStake');
    });

    it('Should fail to create stake for zero address', async function () {
      const { staking } = await loadFixture(deployFixture);

      const amount = ethers.parseEther('10');

      await expect(
        staking.createStakeFor(ethers.ZeroAddress, { value: amount }),
      ).to.be.revertedWithCustomError(staking, 'InvalidRecipientAddress');
    });

    it('Should fail to transfer stake to the zero address', async function () {
      const { staking } = await loadFixture(deployFixture);

      const amount = ethers.parseEther('10');
      await staking.createStake({ value: amount });

      await expect(
        staking.transferStake(ethers.ZeroAddress, amount),
      ).to.be.revertedWithCustomError(staking, 'InvalidRecipientAddress');
    });

    it('Should stake/unstake before emission start', async function () {
      const { owner } = await loadFixture(deployFixture);

      // deploy staking contract with emission start in the future
      const { staking } = await ignition.deploy(stakingModule, {
        parameters: {
          StakingModule: {
            unstakingFeeRatio,
            owner: owner.address,
            emissionStart: (await time.latest()) + 1000,
            firstCheckPoint: (await time.latest()) + 2000,
            rewardPerSecond,
          },
          TimelockControllerModule: {
            // set the timelock duration to 0, so that the upgrade can be executed immediately for the unittest
            minDelay: 0,
          },
        },
      });

      const stakeAmount = ethers.parseEther('10');

      const tx1 = await staking.createStake({ value: stakeAmount });
      let receipt = await tx1.wait();
      let feesPaid = receipt?.fee ?? 0n;

      const unstakingFee = (stakeAmount * unstakingFeeRatio) / 10000n;
      const initialBalanceBeforeUnstake = await ethers.provider.getBalance(
        owner.address,
      );

      const tx2 = await staking.removeStake(stakeAmount, unstakingFee);
      receipt = await tx2.wait();
      feesPaid += receipt?.fee ?? 0n;

      expect(await staking.stakes(owner.address)).to.equal(0);
      expect(await staking.totalStake()).to.equal(0);
      expect(
        await ethers.provider.getBalance(await staking.getAddress()),
      ).to.equal(unstakingFee);

      // Check owner balance increased by stake amount minus fee (accounting for gas fees)
      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.greaterThan(
        initialBalanceBeforeUnstake + stakeAmount - unstakingFee - feesPaid,
      );
    });
  });

  describe('Reward Logic', function () {
    it('Should reward staking during a single emission period', async function () {
      const { staking, staker } = await loadFixture(deployFixture);

      const now = await time.latest();
      const emissionPeriod: EmissionPeriod = {
        endTime: now + 1000,
        rewardPerSecond: ethers.parseEther('0.01'),
      };
      await staking.updateSchedule(
        emissionPeriod.endTime,
        emissionPeriod.rewardPerSecond,
      );

      const stakeAmount = ethers.parseEther('10');
      const duration = 300;
      const initialBalance = await ethers.provider.getBalance(staker.address);

      const startTime = now + 200;
      await time.setNextBlockTimestamp(startTime);
      const tx1 = await staking
        .connect(staker)
        .createStake({ value: stakeAmount });
      let receipt = await tx1.wait();
      let feesPaid = receipt?.fee ?? 0n;

      await time.setNextBlockTimestamp(startTime + duration);
      const expectedReward = emissionPeriod.rewardPerSecond * BigInt(duration);

      const tx2 = await staking.connect(staker).getReward();
      receipt = await tx2.wait();
      feesPaid += receipt?.fee ?? 0n;

      expect(
        await ethers.provider.getBalance(staker.address),
      ).to.be.greaterThanOrEqual(
        initialBalance - stakeAmount + expectedReward - feesPaid,
      );
      expect(
        await staking.getStake(staker.address),
        'stake of staker',
      ).to.equal(stakeAmount);
    });

    it('Should reward staking across multiple emission periods', async function () {
      const { staking, staker } = await loadFixture(deployFixture);

      const now = await time.latest();
      const emissionPeriods: EmissionPeriod[] = [
        {
          endTime: now + 1000,
          rewardPerSecond: ethers.parseEther('0.02'),
        },
        {
          endTime: now + 2000,
          rewardPerSecond: ethers.parseEther('0.03'),
        },
        {
          endTime: now + 3000,
          rewardPerSecond: ethers.parseEther('0.05'),
        },
      ];

      for (const period of emissionPeriods) {
        await staking.updateSchedule(period.endTime, period.rewardPerSecond);
      }

      const stakeAmount = ethers.parseEther('10');
      const initialBalance = await ethers.provider.getBalance(staker.address);

      const stakeTime = now + 500; // Stake at halfway through the first emission period
      await time.setNextBlockTimestamp(stakeTime);
      const tx1 = await staking
        .connect(staker)
        .createStake({ value: stakeAmount });
      let receipt = await tx1.wait();
      let feesPaid = receipt?.fee ?? 0n;

      // Fast forward to the middle of the third emission period
      await time.setNextBlockTimestamp(now + 2500);

      // Calculate expected rewards
      const firstPeriodReward =
        emissionPeriods[0].rewardPerSecond * BigInt(500);
      const secondPeriodReward =
        emissionPeriods[1].rewardPerSecond *
        BigInt(emissionPeriods[1].endTime - emissionPeriods[0].endTime);
      const thirdPeriodReward =
        emissionPeriods[2].rewardPerSecond * BigInt(500);

      const expectedTotalReward =
        firstPeriodReward + secondPeriodReward + thirdPeriodReward;

      const tx2 = await staking.connect(staker).getReward();
      receipt = await tx2.wait();
      feesPaid += receipt?.fee ?? 0n;
      expect(await ethers.provider.getBalance(staker.address)).to.be.equal(
        initialBalance - stakeAmount + expectedTotalReward - feesPaid,
      );
    });

    it('Should reward staking across multiple emission periods with a undefined gap in between', async function () {
      const { staking, staker } = await loadFixture(deployFixture);

      const now = await time.latest();
      const emissionPeriods: EmissionPeriod[] = [
        {
          endTime: now + 1000,
          rewardPerSecond: ethers.parseEther('0.01'),
        },
        // gap between +1000 and +2000 because the next period gets defined at +2000
        {
          endTime: now + 3000,
          rewardPerSecond: ethers.parseEther('0.02'),
        },
      ];

      await staking.updateSchedule(
        emissionPeriods[0].endTime,
        emissionPeriods[0].rewardPerSecond,
      );

      const stakeAmount = ethers.parseEther('10');
      const initialBalance = await ethers.provider.getBalance(staker.address);

      const stakeTime = now + 500; // Stake at halfway through the first emission period
      await time.setNextBlockTimestamp(stakeTime);
      const tx1 = await staking
        .connect(staker)
        .createStake({ value: stakeAmount });
      let receipt = await tx1.wait();
      let feesPaid = receipt?.fee ?? 0n;

      // Let the emission period run out and enter a undefined gap before the next period gets defined
      await time.setNextBlockTimestamp(now + 2000);
      await staking.updateSchedule(
        emissionPeriods[1].endTime,
        emissionPeriods[1].rewardPerSecond,
      );

      // Fast forward to the middle of the second emission period
      await time.setNextBlockTimestamp(now + 2500);

      // Calculate expected rewards
      const expectedTotalReward =
        emissionPeriods[0].rewardPerSecond * BigInt(500) +
        emissionPeriods[1].rewardPerSecond * BigInt(500);

      const tx2 = await staking.connect(staker).getReward();
      receipt = await tx2.wait();
      feesPaid += receipt?.fee ?? 0n;
      expect(await ethers.provider.getBalance(staker.address)).to.be.equal(
        initialBalance - stakeAmount + expectedTotalReward - feesPaid,
      );
    });

    it('Should reward staking with multiple users and emission periods', async function () {
      const { staking, staker, staker2, depositedReward } =
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
        await staking.updateSchedule(period.endTime, period.rewardPerSecond);
      }

      let expectedStakesStaker = 0n;
      let expectedStakesStaker2 = 0n;
      let expectedRewardsStaker = 0n;
      let expectedRewardsStaker2 = 0n;
      let feesPaidStaker2 = 0n;
      expect(
        await staking.showPendingReward(staker.address),
        'pending reward staker, start',
      ).to.equal(expectedRewardsStaker);
      expect(
        await staking.showPendingReward(staker2.address),
        'pending reward staker2, start',
      ).to.equal(expectedRewardsStaker2);

      // first only the owner stakes
      await time.setNextBlockTimestamp(start + 100);
      const tx1 = await staking
        .connect(staker)
        .createStake({ value: ethers.parseEther('5') });
      let receipt = await tx1.wait();
      expectedStakesStaker += ethers.parseEther('5');

      // later in the same period the other account stakes
      await time.setNextBlockTimestamp(start + 700);
      const tx2 = await staking
        .connect(staker2)
        .createStake({ value: ethers.parseEther('10') });
      receipt = await tx2.wait();
      feesPaidStaker2 += receipt?.fee ?? 0n;
      expectedStakesStaker2 += ethers.parseEther('10');
      let lastUpdateTime = await time.latest();

      expectedRewardsStaker +=
        emissionPeriods[0].rewardPerSecond * BigInt(700 - 100);
      expect(
        await staking.showPendingReward(staker.address),
        'pending reward staker, first period',
      ).to.equal(expectedRewardsStaker);
      expect(
        await staking.stakes(staker.address),
        'stake staker, first period',
      ).to.equal(expectedStakesStaker);
      expect(
        await staking.stakes(staker2.address),
        'stake staker2, first period',
      ).to.equal(expectedStakesStaker2);

      // in the second period the staker increases his stake
      await time.setNextBlockTimestamp(start + 1300);
      const tx3 = await staking
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
        await staking.stakes(staker.address),
        'stake staker, second period',
      ).to.equal(expectedStakesStaker);
      expect(
        await staking.stakes(staker2.address),
        'stake staker2, second period',
      ).to.equal(expectedStakesStaker2);
      expect(
        await staking.showPendingReward(staker.address),
        'pending reward staker, second period',
      ).to.equal(expectedRewardsStaker);
      expect(
        await staking.showPendingReward(staker2.address),
        'pending reward staker2, second period',
      ).to.equal(expectedRewardsStaker2);

      // remember maximum total stake for calculating the fee later
      const maximumTotalStake = expectedStakesStaker + expectedStakesStaker2;

      // in the third period the other account withdraws his rewards
      await time.setNextBlockTimestamp(start + 2000);
      const staker2AccountBalanceBeforeReward =
        await ethers.provider.getBalance(staker2.address);
      const tx4 = await staking.connect(staker2).getReward();
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
        await staking.stakes(staker.address),
        'stake staker, third period',
      ).to.equal(expectedStakesStaker);
      expect(
        await staking.stakes(staker2.address),
        'stake staker2, third period',
      ).to.equal(expectedStakesStaker2);
      expect(
        await staking.showPendingReward(staker.address),
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
        await staking.showPendingReward(staker2.address),
        'pending reward staker2, third period',
      ).to.equal(0); // because the other account withdrew his rewards
      let withdrawnRewards = expectedRewardsStaker2;
      expectedRewardsStaker2 = 0n;

      // in the forth period the staker unstakes half of his tokens
      await time.setNextBlockTimestamp(start + 3500);
      const tx5 = await staking
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
        await staking.stakes(staker.address),
        'stake staker, fourth period',
      ).to.equal(expectedStakesStaker);
      expect(
        await staking.stakes(staker2.address),
        'stake staker2, fourth period',
      ).to.equal(expectedStakesStaker2);
      expect(
        await staking.showPendingReward(staker.address),
        'pending reward staker, fourth period',
      ).to.be.closeTo(expectedRewardsStaker, 100n);
      expect(
        await staking.showPendingReward(staker2.address),
        'pending reward staker2, fourth period',
      ).to.be.closeTo(expectedRewardsStaker2, 100n);

      // in the distant future both accounts withdraw all stake and rewards
      await time.setNextBlockTimestamp(start + 6666);
      const tx6 = await staking
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
        await staking.showPendingReward(staker.address),
        'pending reward staker, distant future',
      ).to.be.closeTo(expectedRewardsStaker, 100n);
      expect(
        await staking.showPendingReward(staker2.address),
        'pending reward staker2, distant future',
      ).to.be.closeTo(expectedRewardsStaker2, 100n);
      const tx7 = await staking.connect(staker).getReward();
      receipt = await tx7.wait();
      const tx8 = await staking.connect(staker2).getReward();
      receipt = await tx8.wait();
      feesPaidStaker2 += receipt?.fee ?? 0n;
      const tx9 = await staking
        .connect(staker)
        .removeStake(expectedStakesStaker, expectedStakesStaker);
      receipt = await tx9.wait();
      withdrawnRewards += expectedRewardsStaker + expectedRewardsStaker2;

      expect(
        await staking.stakes(staker.address),
        'stake staker, end',
      ).to.equal(0n);
      expect(
        await staking.stakes(staker2.address),
        'stake staker2, end',
      ).to.equal(0n);
      expect(
        await staking.showPendingReward(staker.address),
        'pending reward staker, end',
      ).to.equal(0n);
      expect(
        await staking.showPendingReward(staker2.address),
        'pending reward staker2, end',
      ).to.equal(0n);

      // check fee amounts that were paid for unstaking
      const expectedUnstakingFee =
        (maximumTotalStake * unstakingFeeRatio) / 10000n;
      expect(
        await ethers.provider.getBalance(await staking.getAddress()),
        'balance of staking contract, end',
      ).to.equal(expectedUnstakingFee + depositedReward - withdrawnRewards);
    });
  });

  describe('Schedule updates', function () {
    it('Should not allow to update schedule if not owner', async function () {
      const { staking, otherAccount } = await loadFixture(deployFixture);

      await expect(
        staking
          .connect(otherAccount)
          .updateSchedule(1000, ethers.parseEther('1')),
      ).to.be.revertedWithCustomError(staking, 'OwnableUnauthorizedAccount');
    });

    it('Should update schedule', async function () {
      const { staking } = await loadFixture(deployFixture);

      const newEndTime = (await time.latest()) + 123;
      const newRewardPerSecond = ethers.parseEther('1');
      await staking.updateSchedule(newEndTime, newRewardPerSecond);

      // the smart contract should now have 4 check points
      // 0: emissionStart
      // 1: firstCheckPoint
      // 2: time.latest() for ending the undefined gap with 0 rewards
      // 3: newEndTime for the new period

      // check points 0 and 1 should not have changed
      expect(await staking.checkPoints(0)).to.equal(emissionStart);
      expect(await staking.checkPoints(1)).to.equal(firstCheckPoint);

      // covering the undefined gap
      expect(await staking.checkPoints(2)).to.equal(await time.latest());
      expect(await staking.rewardPerSecond(1)).to.equal(0);

      // the new period
      expect(await staking.checkPoints(3)).to.equal(newEndTime);
      expect(await staking.rewardPerSecond(2)).to.equal(newRewardPerSecond);
    });
  });

  describe('Unstaking Fee', function () {
    it('Should fail when fee is above accepted level', async function () {
      const { staking } = await loadFixture(deployFixture);

      const stakeAmount = ethers.parseEther('10');
      await staking.createStake({ value: stakeAmount });

      await expect(
        staking.removeStake(stakeAmount, 1n),
      ).to.be.revertedWithCustomError(staking, 'FeeTooHigh');
    });

    it('Should keep the unstaking fee', async function () {
      const { staking, owner, depositedReward } =
        await loadFixture(deployFixture);

      const stakeAmount = ethers.parseEther('10');

      const tx1 = await staking.createStake({ value: stakeAmount });
      let receipt = await tx1.wait();
      let feesPaid = receipt?.fee ?? 0n;

      const unstakeAmount = ethers.parseEther('7');
      const expectedUnstakingFee =
        (unstakeAmount * unstakingFeeRatio) /
        (await staking.UNSTAKING_FEE_DENOMINATOR());
      const initialBalanceBeforeUnstake = await ethers.provider.getBalance(
        owner.address,
      );

      const tx2 = await staking.removeStake(
        unstakeAmount,
        expectedUnstakingFee,
      );
      receipt = await tx2.wait();
      feesPaid += receipt?.fee ?? 0n;

      expect(
        await ethers.provider.getBalance(await staking.getAddress()),
        'staking contract balance',
      ).to.equal(
        stakeAmount - unstakeAmount + expectedUnstakingFee + depositedReward,
      );
      expect(await staking.stakes(owner.address), 'stake of owner').to.equal(
        stakeAmount - unstakeAmount,
      );
      expect(await staking.totalStake(), 'total stake').to.equal(
        stakeAmount - unstakeAmount,
      );

      // Check owner balance increased by unstake amount minus fee (accounting for gas fees)
      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.greaterThan(
        initialBalanceBeforeUnstake +
          unstakeAmount -
          expectedUnstakingFee -
          feesPaid,
      );
    });

    it('Should keep unstaking fees in the contract', async function () {
      const { staking, depositedReward } = await loadFixture(deployFixture);

      const stakeAmount = ethers.parseEther('10');
      await staking.createStake({ value: stakeAmount });

      const unstakeAmount1 = ethers.parseEther('7');
      await staking.removeStake(unstakeAmount1, unstakeAmount1);
      const unstakeAmount2 = ethers.parseEther('2');
      await staking.removeStake(unstakeAmount2, unstakeAmount2);

      const expectedUnstakingFee =
        ((unstakeAmount1 + unstakeAmount2) * unstakingFeeRatio) /
        (await staking.UNSTAKING_FEE_DENOMINATOR());
      expect(await staking.getCollectedFees(), 'total fees').to.equal(
        expectedUnstakingFee,
      );

      // Fees should remain in the staking contract
      expect(
        await ethers.provider.getBalance(await staking.getAddress()),
        'staking contract balance',
      ).to.equal(
        stakeAmount -
          unstakeAmount1 -
          unstakeAmount2 +
          expectedUnstakingFee +
          depositedReward,
      );
    });
  });

  describe('Unstaking Fee Ratio', function () {
    it('Should change the unstaking fee', async function () {
      const { staking } = await loadFixture(deployFixture);
      const newUnstakingFeeRatio = 1234; // higher than before

      await staking.registerNewUnstakingFeeRatio(newUnstakingFeeRatio);
      await time.setNextBlockTimestamp(
        BigInt(await time.latest()) +
          (await staking.UNSTAKING_FEE_RATIO_TIMELOCK_PERIOD()) +
          1n,
      );
      await staking.changeUnstakingFeeRatio();

      expect(await staking.unstakingFeeRatio()).to.equal(newUnstakingFeeRatio);
    });

    it('Should fail to change the unstaking fee if not owner', async function () {
      const { staking, otherAccount } = await loadFixture(deployFixture);

      await expect(
        staking.connect(otherAccount).registerNewUnstakingFeeRatio(0),
      ).to.be.revertedWithCustomError(staking, 'OwnableUnauthorizedAccount');
    });

    it('Should fail to change the unstaking fee immediately', async function () {
      const { staking } = await loadFixture(deployFixture);

      await expect(
        staking.changeUnstakingFeeRatio(),
      ).to.be.revertedWithCustomError(staking, 'TooEarlyToChangeUnstakingFee');
    });

    it('Should fail to change the unstaking fee before the timelock has passed', async function () {
      const { staking } = await loadFixture(deployFixture);
      const newUnstakingFeeRatio = 1234; // higher than before

      await staking.registerNewUnstakingFeeRatio(newUnstakingFeeRatio);
      await time.setNextBlockTimestamp(BigInt(await time.latest()) + 5n);

      await expect(
        staking.changeUnstakingFeeRatio(),
      ).to.be.revertedWithCustomError(staking, 'TooEarlyToChangeUnstakingFee');
    });

    it('Should lower the unstaking fee immediately', async function () {
      const { staking } = await loadFixture(deployFixture);
      const newUnstakingFeeRatio = 12; // lower than before

      await staking.registerNewUnstakingFeeRatio(newUnstakingFeeRatio);

      expect(await staking.unstakingFeeRatio()).to.equal(newUnstakingFeeRatio);
    });
  });

  describe('Events', function () {
    it('Should emit staking events', async function () {
      const { staking, staker, staker2 } = await loadFixture(deployFixture);

      const stakeAmount = ethers.parseEther('10');
      const halfStakeAmount = stakeAmount / 2n;

      await expect(staking.connect(staker).createStake({ value: stakeAmount }))
        .to.emit(staking, 'CreateStake')
        .withArgs(staker.address, stakeAmount);
      await expect(
        staking.connect(staker).removeStake(halfStakeAmount, halfStakeAmount),
      )
        .to.emit(staking, 'RemoveStake')
        .withArgs(staker.address, halfStakeAmount);
      await expect(
        staking.connect(staker).transferStake(staker2.address, halfStakeAmount),
      )
        .to.emit(staking, 'RemoveStake')
        .withArgs(staker.address, halfStakeAmount)
        .and.emit(staking, 'CreateStake')
        .withArgs(staker2.address, halfStakeAmount);
    });

    it('Should emit reward events', async function () {
      const { staking, staker } = await loadFixture(deployFixture);

      const now = await time.latest();
      const emissionPeriod: EmissionPeriod = {
        endTime: now + 1000,
        rewardPerSecond: ethers.parseEther('0.01'),
      };
      await staking.updateSchedule(
        emissionPeriod.endTime,
        emissionPeriod.rewardPerSecond,
      );

      const stakeAmount = ethers.parseEther('10');
      const duration = 300;

      const startTime = now + 200;
      await time.setNextBlockTimestamp(startTime);
      await staking.connect(staker).createStake({ value: stakeAmount });

      await time.setNextBlockTimestamp(startTime + duration);
      const expectedReward = emissionPeriod.rewardPerSecond * BigInt(duration);

      await expect(staking.connect(staker).getReward())
        .to.emit(staking, 'RewardPaid')
        .withArgs(staker.address, expectedReward);
    });

    it('Should emit fee change events', async function () {
      const { staking } = await loadFixture(deployFixture);
      const newUnstakingFeeRatio = 1234;

      await expect(staking.registerNewUnstakingFeeRatio(newUnstakingFeeRatio))
        .to.emit(staking, 'FeeChangeRequested')
        .withArgs(newUnstakingFeeRatio);
      await time.setNextBlockTimestamp(
        BigInt(await time.latest()) +
          (await staking.UNSTAKING_FEE_RATIO_TIMELOCK_PERIOD()) +
          1n,
      );
      await expect(staking.changeUnstakingFeeRatio())
        .to.emit(staking, 'FeeChanged')
        .withArgs(newUnstakingFeeRatio);
    });

    it('Should emit emission period added events', async function () {
      const { staking } = await loadFixture(deployFixture);
      const now = await time.latest();
      const updateTime = now + 10;
      const newEndTime = (await time.latest()) + 1000;
      const newRewardPerSecond = ethers.parseEther('1');

      await time.setNextBlockTimestamp(updateTime);
      await expect(staking.updateSchedule(newEndTime, newRewardPerSecond))
        .to.emit(staking, 'EmissionPeriodAdded')
        .withArgs(updateTime, newEndTime, newRewardPerSecond);
    });

    it('Should emit emission period added events twice when done in an undefined gap', async function () {
      const { staking } = await loadFixture(deployFixture);
      const gapStart = (await time.latest()) + 10;
      await staking.updateSchedule(gapStart, 3n);

      const changeTime = BigInt(gapStart) + 5n;
      await time.setNextBlockTimestamp(changeTime);
      const newCheckpoint = (await time.latest()) + 1000;
      const newRewardPerSecond = ethers.parseEther('1');

      await expect(staking.updateSchedule(newCheckpoint, newRewardPerSecond))
        .to.emit(staking, 'EmissionPeriodAdded')
        .withArgs(gapStart, changeTime, 0)
        .and.emit(staking, 'EmissionPeriodAdded')
        .withArgs(changeTime, newCheckpoint, newRewardPerSecond);
    });

    it('Should distribute extra rewards', async function () {
      const { staking, staker, staker2 } = await loadFixture(deployFixture);

      await staking.distributeExtraRewards(
        [staker.address, staker2.address],
        [ethers.parseEther('10'), ethers.parseEther('20')],
        { value: ethers.parseEther('30') },
      );

      expect(await staking.rewards(staker.address)).to.equal(
        ethers.parseEther('10'),
      );
      expect(await staking.showPendingReward(staker.address)).to.equal(
        ethers.parseEther('10'),
      );

      expect(await staking.rewards(staker2.address)).to.equal(
        ethers.parseEther('20'),
      );
      expect(await staking.showPendingReward(staker2.address)).to.equal(
        ethers.parseEther('20'),
      );

      const staker2BalanceBeforeReward = await ethers.provider.getBalance(
        staker2.address,
      );
      const tx1 = await staking.connect(staker2).getReward();
      const receipt = await tx1.wait();
      const feesPaid = receipt?.fee ?? 0n;
      expect(await staking.showPendingReward(staker2.address)).to.equal(0);
      expect(await ethers.provider.getBalance(staker2.address)).to.be.closeTo(
        staker2BalanceBeforeReward + ethers.parseEther('20') - feesPaid,
        1000n,
      );
    });
  });
});
