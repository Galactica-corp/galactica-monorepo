import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { network, ethers, ignition } from 'hardhat';

import { assertBNClosePercent } from './helpers/assertions';
import {
  ONE_WEEK,
  ONE_HOUR,
  ONE_DAY,
  ONE_YEAR,
  TWO_YEARS,
  DEFAULT_DECIMALS,
} from './helpers/constants';
import type { BN } from './helpers/math';
import { simpleToExactAmount, maximum } from './helpers/math';
import votingEscrowModule from '../../ignition/modules/VotingEscrow.m';
import type { VotingEscrow } from '../../typechain-types/contracts/VotingEscrow';

let votingLockup: VotingEscrow;
let admin: any;
let defaultUser: any;
let other: any;
let fundManager: any;
let accounts: any[];
let alice: any;
let bob: any;
let charlie: any;
let david: any;
let eve: any;
let francis: any;
let treasury: any;

/**
 * @returns The current block number in BigInt
 */
async function latestBlockBN() {
  const block = await ethers.provider.getBlock('latest');
  if (!block) {
    throw new Error('Failed to get latest block');
  }
  return BigInt(block.number);
}
/**
 * @returns The current timestamp in BigInt
 */
async function getTimestampBN() {
  const block = await ethers.provider.getBlock('latest');
  if (!block) {
    throw new Error('Failed to get latest block');
  }
  return BigInt(block.timestamp);
}

describe('VotingEscrow Math test', () => {
  before('Init contract', async () => {
    accounts = await ethers.getSigners();

    [
      admin,
      defaultUser,
      other,
      fundManager,
      alice,
      bob,
      charlie,
      david,
      eve,
      francis,
      treasury,
    ] = accounts;
  });

  const isCoverage = network.name === 'coverage';

  const goToNextUnixWeekStart = async () => {
    const currentTimestamp = await getTimestampBN();
    const unixWeekCount = currentTimestamp / ONE_WEEK;
    const nextUnixWeek = (unixWeekCount + 1n) * ONE_WEEK;
    await time.increaseTo(nextUnixWeek);
  };

  const deployFresh = async () => {
    const wGNET = await ethers.deployContract('WGNET10');

    const { votingEscrow } = await ignition.deploy(votingEscrowModule, {
      parameters: {
        VotingEscrowModule: {
          owner: admin.address,
          penaltyRecipient: treasury.address,
          name: 'veToken',
          symbol: 'veToken',
          wGNET: await wGNET.getAddress(),
        },
        TimelockControllerModule: {
          minDelay: 0,
        },
      },
    });

    votingLockup = votingEscrow as unknown as VotingEscrow;

    // Fund accounts with native tokens
    await ethers.provider.send('hardhat_setBalance', [
      fundManager.address,
      `0x${ethers.parseEther('1000000000000').toString(16)}`,
    ]);
    await ethers.provider.send('hardhat_setBalance', [
      defaultUser.address,
      `0x${simpleToExactAmount(1000, DEFAULT_DECIMALS).toString(16)}`,
    ]);
    await ethers.provider.send('hardhat_setBalance', [
      other.address,
      `0x${simpleToExactAmount(1000, DEFAULT_DECIMALS).toString(16)}`,
    ]);
  };

  describe('checking balances & total supply', () => {
    before(async () => {
      await deployFresh();
    });
    describe('before any stakes are made', () => {
      it('returns balances', async () => {
        // expect(await votingLockup.staticBalanceOf(defaultUser.address)).eq(BN.from(0))
        expect(await votingLockup.balanceOf(defaultUser.address)).eq(0n);
        expect(await votingLockup.balanceOfAt(defaultUser.address, 1)).eq(0n);
      });
      it('returns balance at latest block', async () => {
        expect(
          await votingLockup.balanceOfAt(
            defaultUser.address,
            await latestBlockBN(),
          ),
        ).eq(0n);
      });
      it('returns totalSupply', async () => {
        expect(await votingLockup.totalSupply()).eq(0n);
        expect(await votingLockup.totalSupplyAt(1)).eq(0n);
      });
      it('returns totalSupply at latest block', async () => {
        expect(await votingLockup.totalSupplyAt(await latestBlockBN())).eq(0n);
      });
    });
    describe('fetching for current block', () => {
      it('fails for balanceOfAt', async () => {
        await expect(
          votingLockup.balanceOfAt(
            defaultUser.address,
            (await latestBlockBN()) + 1n,
          ),
        ).to.be.revertedWith('Only past block number');
      });
      it('fails for supply', async () => {
        await expect(
          votingLockup.totalSupplyAt((await latestBlockBN()) + 1n),
        ).to.be.revertedWith('Only past block number');
      });
    });
  });

  type LockedBalance = {
    amount: BN;
    end: BN;
  };

  type Point = {
    bias: BN;
    slope: BN;
    ts: BN;
    blk?: BN;
  };

  type ContractData = {
    epoch: BN;
    userEpoch: BN;
    userLocked: LockedBalance;
    userLastPoint: Point;
    lastPoint: Point;
    senderStakingTokenBalance: BN;
    contractStakingTokenBalance: BN;
  };

  const snapshotData = async (sender = defaultUser): Promise<ContractData> => {
    const locked = await votingLockup.locked(sender.address);
    const userLastPoint = await votingLockup.getLastUserPoint(sender.address);
    const epoch = await votingLockup.globalEpoch();
    const userEpoch = await votingLockup.userPointEpoch(sender.address);
    const lastPoint = await votingLockup.pointHistory(epoch);
    return {
      epoch,
      userEpoch,
      userLocked: {
        amount: locked[0],
        end: locked[1],
      },
      userLastPoint: {
        bias: userLastPoint[0],
        slope: userLastPoint[1],
        ts: userLastPoint[2],
      },
      lastPoint: {
        bias: lastPoint[0],
        slope: lastPoint[1],
        ts: lastPoint[2],
        blk: lastPoint[3],
      },
      senderStakingTokenBalance: await ethers.provider.getBalance(
        sender.address,
      ),
      contractStakingTokenBalance: await ethers.provider.getBalance(
        await votingLockup.getAddress(),
      ),
    };
  };

  // Flow performed with 4 stakers
  // 1 - stakes 10 for a year
  // 2 - stakes 1000 for 6 months
  //   - increases time after 3 to 12m
  // 3 - stakes 10 for 6 months
  //   - increases amount after 3
  //   - gets ejected after 6m
  // 4 - stakes 10 from 3-6 mo & exits
  // 5 - stakes 10 at start for 1 week
  describe('performing full system flow', () => {
    // let alice: Account
    // let bob: Account
    // let charlie: Account
    // let david: Account
    // let eve: Account

    const stakeAmt1 = ethers.parseEther('10');
    const stakeAmt2 = ethers.parseEther('1000');
    let start: bigint;
    let maxTime: bigint;
    before(async () => {
      await goToNextUnixWeekStart();
      start = await getTimestampBN();
      await deployFresh();
      maxTime = await votingLockup.MAXTIME();
      // Fund accounts with native tokens
      await ethers.provider.send('hardhat_setBalance', [
        alice.address,
        `0x${simpleToExactAmount(1, 22).toString(16)}`,
      ]);
      await ethers.provider.send('hardhat_setBalance', [
        bob.address,
        `0x${simpleToExactAmount(1, 22).toString(16)}`,
      ]);
      await ethers.provider.send('hardhat_setBalance', [
        charlie.address,
        `0x${simpleToExactAmount(1, 22).toString(16)}`,
      ]);
      await ethers.provider.send('hardhat_setBalance', [
        david.address,
        `0x${simpleToExactAmount(1, 22).toString(16)}`,
      ]);
      await ethers.provider.send('hardhat_setBalance', [
        eve.address,
        `0x${simpleToExactAmount(1, 22).toString(16)}`,
      ]);
      await ethers.provider.send('hardhat_setBalance', [
        francis.address,
        `0x${simpleToExactAmount(1, 22).toString(16)}`,
      ]);
    });
    describe('checking initial settings', () => {
      it('sets ERC20 details', async () => {
        const name = await votingLockup.name();
        const symbol = await votingLockup.symbol();
        const decimals = await votingLockup.decimals();
        const supply = await votingLockup.totalSupply();
        expect(name).eq('veToken');
        expect(symbol).eq('veToken');
        expect(decimals).eq(DEFAULT_DECIMALS);
        expect(supply).eq(0n);
      });
    });

    const calcBias = (amount: bigint, len: bigint): bigint =>
      (amount / maxTime) * len;

    describe('creating a lockup', () => {
      it('allows user to create a lock', async () => {
        await votingLockup
          .connect(alice)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(bob)
          .createLock(start + ONE_WEEK * 26n, { value: stakeAmt2 });
        await votingLockup
          .connect(charlie)
          .createLock(start + ONE_WEEK * 26n, { value: stakeAmt1 });
        await votingLockup
          .connect(eve)
          .createLock(start + ONE_WEEK, { value: stakeAmt1 });
        await votingLockup
          .connect(francis)
          .createLock(start + TWO_YEARS, { value: stakeAmt1 });

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);
        const eveData = await snapshotData(eve);
        const francisData = await snapshotData(francis);
        // Bias
        assertBNClosePercent(
          aliceData.userLastPoint.bias,
          calcBias(stakeAmt1, ONE_YEAR),
          '0.4',
        );
        assertBNClosePercent(
          bobData.userLastPoint.bias,
          calcBias(stakeAmt2, ONE_WEEK * 26n),
          '0.4',
        );
        assertBNClosePercent(
          charlieData.userLastPoint.bias,
          calcBias(stakeAmt1, ONE_WEEK * 26n),
          '0.4',
        );
        assertBNClosePercent(
          eveData.userLastPoint.bias,
          calcBias(stakeAmt1, ONE_WEEK),
          '0.4',
        );
        assertBNClosePercent(
          francisData.userLastPoint.bias,
          calcBias(stakeAmt1, TWO_YEARS),
          '0.4',
        );
      });
      it('rejects if the params are wrong', async () => {
        await expect(
          votingLockup
            .connect(other)
            .createLock(start + ONE_WEEK, { value: 0 }),
        ).to.be.revertedWith('Only non zero amount');
        await expect(
          votingLockup
            .connect(alice)
            .createLock(start + ONE_WEEK, { value: 1 }),
        ).to.be.revertedWith('Lock exists');
        await expect(
          votingLockup
            .connect(other)
            .createLock(start - ONE_WEEK, { value: 1 }),
        ).to.be.revertedWith('Only future lock end');
      });
      it('only allows creation up until END date', async () => {
        await expect(
          votingLockup
            .connect(other)
            .createLock(start + maxTime + ONE_WEEK, { value: 1 }),
        ).to.be.revertedWith('Exceeds maxtime');
      });
    });

    describe('extending lock', () => {
      before(async () => {
        await time.increaseTo(start + ONE_WEEK * 12n);
        // Eves lock is now expired
      });
      describe('by amount', () => {
        it('fails if conditions are not met', async () => {
          await expect(
            votingLockup.connect(alice).increaseAmount({ value: 0 }),
          ).to.be.revertedWith('Only non zero amount');
          await expect(
            votingLockup.connect(eve).increaseAmount({ value: 1 }),
          ).to.be.revertedWith('Lock expired');
        });
        it('allows someone to increase lock amount', async () => {
          // Account with lock.end>block.timestamp but lock.amount=0
          const aliceBalanceBefore = await votingLockup.balanceOfAt(
            alice.address,
            await latestBlockBN(),
          );
          await votingLockup
            .connect(alice)
            .increaseAmount({ value: stakeAmt1 });
          const aliceBalanceAfter = await votingLockup.balanceOfAt(
            alice.address,
            await latestBlockBN(),
          );
          assertBNClosePercent(
            aliceBalanceBefore * 2n,
            aliceBalanceAfter,
            '0.4',
          );

          // Account with lock.end>block.timestamp and lock.amount>0
          await votingLockup
            .connect(charlie)
            .increaseAmount({ value: stakeAmt2 });
        });
      });

      describe('by length', () => {
        it('fails if conditions are not met', async () => {
          await expect(
            votingLockup.connect(eve).increaseUnlockTime(start + ONE_WEEK),
          ).to.be.revertedWith('Lock expired');
          await expect(
            votingLockup.connect(david).increaseUnlockTime(start + ONE_WEEK),
          ).to.be.revertedWith('No lock');
          await expect(
            votingLockup.connect(alice).increaseUnlockTime(start + ONE_DAY),
          ).to.be.revertedWith('Only increase lock end');
          await expect(
            votingLockup
              .connect(bob)
              .increaseUnlockTime((await getTimestampBN()) + maxTime + ONE_WEEK),
          ).to.be.revertedWith('Exceeds maxtime');

          await expect(
            votingLockup
              .connect(david)
              .createLock((await getTimestampBN()) + maxTime + ONE_WEEK, {
                value: stakeAmt1,
              }),
          ).to.be.revertedWith('Exceeds maxtime');
        });
        it('allows user to extend lock', async () => {
          await goToNextUnixWeekStart();
          await votingLockup.connect(bob).increaseUnlockTime(start + ONE_YEAR);
        });
      });
    });

    describe('trying to withdraw early or with nothing to withdraw', () => {
      it('fails', async () => {
        await expect(votingLockup.connect(alice).withdraw()).to.be.revertedWith(
          'Lock not expired',
        );
        await expect(votingLockup.connect(david).withdraw()).to.be.revertedWith(
          'No lock',
        );
      });
    });

    describe('calling public checkpoint', () => {
      // checkpoint updates point history
      it('allows anyone to call checkpoint and update the history', async () => {
        const before = await snapshotData(alice);
        await votingLockup.checkpoint();
        const after = await snapshotData(alice);

        expect(after.epoch).eq(before.epoch + 1n);
        expect(after.lastPoint.bias).lt(before.lastPoint.bias);
        expect(after.lastPoint.slope).eq(before.lastPoint.slope);
        expect(after.lastPoint.blk).eq(await latestBlockBN());
      });
    });

    describe('calling the getters', () => {
      // returns 0 if 0
      it('allows anyone to get last user point', async () => {
        const userLastPoint = await votingLockup.getLastUserPoint(
          alice.address,
        );
        const epoch = await votingLockup.userPointEpoch(alice.address);
        const point = await votingLockup.userPointHistory(alice.address, epoch);
        expect(userLastPoint[0]).eq(point[0]);
        expect(userLastPoint[1]).eq(point[1]);
        expect(userLastPoint[2]).eq(point[2]);
      });
    });

    describe('exiting the system', () => {
      before(async () => {
        start = await getTimestampBN();
        await votingLockup
          .connect(david)
          .createLock(start + ONE_WEEK * 13n, { value: stakeAmt1 });
        await time.increaseTo(start + ONE_WEEK * 14n);
      });
      it('allows user to withdraw', async () => {
        // david withdraws
        const davidBefore = await snapshotData(david);
        const tx = await votingLockup.connect(david).withdraw();
        const receipt = await tx.wait();
        if (!receipt) {
          throw new Error('Transaction receipt is null');
        }
        const accumulatedFeesDavid = receipt.fee;
        const davidAfter = await snapshotData(david);

        expect(davidAfter.senderStakingTokenBalance).eq(
          davidBefore.senderStakingTokenBalance +
          davidBefore.userLocked.amount -
          accumulatedFeesDavid,
        );
        expect(davidAfter.userLastPoint.bias).eq(0n);
        expect(davidAfter.userLastPoint.slope).eq(0n);
        expect(davidAfter.userLocked.amount).eq(0n);
        expect(davidAfter.userLocked.end).eq(0n);
      });

      it('fully exits the system', async () => {
        // eve exits
        const eveBefore = await snapshotData(eve);
        let tx = await votingLockup.connect(eve).withdraw();
        let receipt = await tx.wait();
        if (!receipt) {
          throw new Error('Transaction receipt is null');
        }
        const accumulatedFeesEve = receipt.fee;
        const eveAfter = await snapshotData(eve);

        expect(eveAfter.senderStakingTokenBalance).eq(
          eveBefore.senderStakingTokenBalance +
          eveBefore.userLocked.amount -
          accumulatedFeesEve,
        );
        expect(eveAfter.userLastPoint.bias).eq(0n);
        expect(eveAfter.userLastPoint.slope).eq(0n);
        expect(eveAfter.userLocked.amount).eq(0n);
        expect(eveAfter.userLocked.end).eq(0n);

        await time.increaseTo(start + ONE_WEEK * 104n);
        const francisBefore = await snapshotData(francis);
        tx = await votingLockup.connect(francis).withdraw();
        receipt = await tx.wait();
        if (!receipt) {
          throw new Error('Transaction receipt is null');
        }
        const accumulatedFeesFrancis = receipt.fee;
        const francisAfter = await snapshotData(francis);

        expect(francisAfter.senderStakingTokenBalance).eq(
          francisBefore.senderStakingTokenBalance +
          francisBefore.userLocked.amount -
          accumulatedFeesFrancis,
        );
        expect(francisAfter.userLastPoint.bias).eq(0n);
        expect(francisAfter.userLastPoint.slope).eq(0n);
        expect(francisAfter.userLocked.amount).eq(0n);
        expect(francisAfter.userLocked.end).eq(0n);
      });
    });
  });

  // Integration test ported from
  // https://github.com/curvefi/curve-dao-contracts/blob/master/tests/integration/VotingEscrow/test_votingLockup.py
  describe('testing voting powers changing', () => {
    before(async () => {
      await deployFresh();
    });

    /**
     *
     * Test voting power in the following scenario.
     * Alice:
     * ~~~~~~~
     * ^
     * | *       *
     * | | \     |  \
     * | |  \    |    \
     * +-+---+---+------+---> t
     *
     * Bob:
     * ~~~~~~~
     * ^
     * |         *
     * |         | \
     * |         |  \
     * +-+---+---+---+--+---> t
     *
     * Alice has 100% of voting power in the first period.
     * She has 2/3 power at the start of 2nd period, with Bob having 1/2 power
     * (due to smaller locktime).
     * Alice's power grows to 100% by Bob's unlock.
     *
     * Checking that totalSupply is appropriate.
     *
     * After the test is done, check all over again with balanceOfAt / totalSupplyAt
     *
     */

    it('calculates voting weights on a rolling basis', async () => {
      /**
       * SETUP
       */
      const MAXTIME = await votingLockup.MAXTIME();
      const tolerance = '0.04'; // 0.04% | 0.00004 | 4e14
      const amount = ethers.parseEther('1000');
      // Fund accounts with native tokens
      await ethers.provider.send('hardhat_setBalance', [
        alice.address,
        `0x${(amount * 5n).toString(16)}`,
      ]);
      await ethers.provider.send('hardhat_setBalance', [
        bob.address,
        `0x${(amount * 5n).toString(16)}`,
      ]);
      const stages: any = {};

      expect(await votingLockup.totalSupply()).eq(0n);
      expect(await votingLockup.balanceOf(alice.address)).eq(0n);
      expect(await votingLockup.balanceOf(bob.address)).eq(0n);

      /**
       * BEGIN PERIOD 1
       * Move to timing which is good for testing - beginning of a UTC week
       * Fund the pool
       */

      await goToNextUnixWeekStart();
      await time.increase(ONE_HOUR);

      stages.before_deposits = [await latestBlockBN(), await getTimestampBN()];

      await votingLockup
        .connect(alice)
        .createLock((await getTimestampBN()) + ONE_WEEK + 1n, {
          value: amount,
        });
      stages.alice_deposit = [await latestBlockBN(), await getTimestampBN()];

      await time.increaseTo((await getTimestampBN()) + ONE_HOUR);
      await ethers.provider.send('evm_mine', []);
      assertBNClosePercent(
        await votingLockup.balanceOf(alice.address),
        (amount / MAXTIME) * (ONE_WEEK - ONE_HOUR * 2n),
        tolerance,
      );
      assertBNClosePercent(
        await votingLockup.totalSupply(),
        (amount / MAXTIME) * (ONE_WEEK - ONE_HOUR * 2n),
        tolerance,
      );
      expect(await votingLockup.balanceOf(bob.address)).eq(0n);
      let t0 = await getTimestampBN();
      let dt = 0n;

      stages.alice_in_0 = [];
      stages.alice_in_0.push([await latestBlockBN(), await getTimestampBN()]);

      /**
       * Measure Alice's decay over whole week
       */
      for (let i = 0; i < 7; i += 1) {
        for (let j = 0; j < 24; j += 1) {
          await time.increaseTo((await getTimestampBN()) + ONE_HOUR);
          await ethers.provider.send('evm_mine', []);
        }
        dt = (await getTimestampBN()) - t0;
        assertBNClosePercent(
          await votingLockup.totalSupply(),
          (amount / MAXTIME) * maximum(ONE_WEEK - ONE_HOUR * 2n - dt, 0n),
          tolerance,
        );
        assertBNClosePercent(
          await votingLockup.balanceOf(alice.address),
          (amount / MAXTIME) * maximum(ONE_WEEK - ONE_HOUR * 2n - dt, 0n),
          tolerance,
        );
        expect(await votingLockup.balanceOf(bob.address)).eq(0n);
        stages.alice_in_0.push([await latestBlockBN(), await getTimestampBN()]);
      }

      await time.increaseTo((await getTimestampBN()) + ONE_HOUR);

      expect(await votingLockup.balanceOf(alice.address)).eq(0n);

      await votingLockup.connect(alice).withdraw();

      stages.alice_withdraw = [await latestBlockBN(), await getTimestampBN()];
      expect(await votingLockup.totalSupply()).eq(0n);
      expect(await votingLockup.balanceOf(alice.address)).eq(0n);
      expect(await votingLockup.balanceOf(bob.address)).eq(0n);

      await time.increaseTo((await getTimestampBN()) + ONE_HOUR);
      await ethers.provider.send('evm_mine', []);

      /**
       * BEGIN PERIOD 2
       * Next week (for round counting)
       */
      await goToNextUnixWeekStart();

      await votingLockup
        .connect(alice)
        .createLock((await getTimestampBN()) + ONE_WEEK * 2n, {
          value: amount,
        });
      stages.alice_deposit_2 = [await latestBlockBN(), await getTimestampBN()];

      assertBNClosePercent(
        await votingLockup.totalSupply(),
        (amount / MAXTIME) * 2n * ONE_WEEK,
        tolerance,
      );
      assertBNClosePercent(
        await votingLockup.balanceOf(alice.address),
        (amount / MAXTIME) * 2n * ONE_WEEK,
        tolerance,
      );
      expect(await votingLockup.balanceOf(bob.address)).eq(0n);

      await votingLockup
        .connect(bob)
        .createLock((await getTimestampBN()) + ONE_WEEK + 1n, {
          value: amount,
        });
      stages.bob_deposit_2 = [await latestBlockBN(), await getTimestampBN()];

      assertBNClosePercent(
        await votingLockup.totalSupply(),
        (amount / MAXTIME) * 3n * ONE_WEEK,
        tolerance,
      );
      assertBNClosePercent(
        await votingLockup.balanceOf(alice.address),
        (amount / MAXTIME) * 2n * ONE_WEEK,
        tolerance,
      );
      assertBNClosePercent(
        await votingLockup.balanceOf(bob.address),
        (amount / MAXTIME) * ONE_WEEK,
        tolerance,
      );

      t0 = await getTimestampBN();
      await time.increaseTo((await getTimestampBN()) + ONE_HOUR);
      await ethers.provider.send('evm_mine', []);

      let wAlice = 0n;
      let wTotal = 0n;
      let wBob = 0n;

      stages.alice_bob_in_2 = [];
      // Beginning of week: weight 3
      // End of week: weight 1
      for (let i = 0; i < 7; i += 1) {
        for (let j = 0; j < 24; j += 1) {
          await time.increaseTo((await getTimestampBN()) + ONE_HOUR);
          await ethers.provider.send('evm_mine', []);
        }
        dt = (await getTimestampBN()) - t0;
        const b = await latestBlockBN();
        wTotal = await votingLockup.totalSupplyAt(b);
        wAlice = await votingLockup.balanceOfAt(alice.address, b);
        wBob = await votingLockup.balanceOfAt(bob.address, b);
        expect(wTotal).eq(wAlice + wBob);
        assertBNClosePercent(
          wAlice,
          (amount / MAXTIME) * maximum(ONE_WEEK * 2n - dt, 0n),
          tolerance,
        );
        assertBNClosePercent(
          wBob,
          (amount / MAXTIME) * maximum(ONE_WEEK - dt, 0n),
          tolerance,
        );
        stages.alice_bob_in_2.push([
          await latestBlockBN(),
          await getTimestampBN(),
        ]);
      }

      await time.increaseTo((await getTimestampBN()) + ONE_HOUR);
      await ethers.provider.send('evm_mine', []);

      await votingLockup.connect(bob).withdraw();
      t0 = await getTimestampBN();
      stages.bob_withdraw_1 = [await latestBlockBN(), await getTimestampBN()];
      wTotal = await votingLockup.totalSupply();
      wAlice = await votingLockup.balanceOf(alice.address);
      expect(wAlice).eq(wTotal);

      assertBNClosePercent(
        wTotal,
        (amount / MAXTIME) * (ONE_WEEK - ONE_HOUR * 2n),
        tolerance,
      );
      expect(await votingLockup.balanceOf(bob.address)).eq(0n);

      await time.increaseTo((await getTimestampBN()) + ONE_HOUR);
      await ethers.provider.send('evm_mine', []);

      stages.alice_in_2 = [];
      for (let i = 0; i < 7; i += 1) {
        for (let j = 0; j < 24; j += 1) {
          await time.increaseTo((await getTimestampBN()) + ONE_HOUR);
          await ethers.provider.send('evm_mine', []);
        }
        dt = (await getTimestampBN()) - t0;
        wTotal = await votingLockup.totalSupply();
        wAlice = await votingLockup.balanceOf(alice.address);
        expect(wTotal).eq(wAlice);
        assertBNClosePercent(
          wTotal,
          (amount / MAXTIME) *
          maximum(
            ONE_WEEK - dt - (ONE_HOUR * 37n) / BigInt(DEFAULT_DECIMALS),
            0n,
          ),
          isCoverage ? '1' : '0.04',
        );
        expect(await votingLockup.balanceOf(bob.address)).eq(0n);
        stages.alice_in_2.push([await latestBlockBN(), await getTimestampBN()]);
      }

      await votingLockup.connect(alice).withdraw();
      stages.alice_withdraw_2 = [await latestBlockBN(), await getTimestampBN()];

      await time.increaseTo((await getTimestampBN()) + ONE_HOUR);
      await ethers.provider.send('evm_mine', []);

      stages.bob_withdraw_2 = [await latestBlockBN(), await getTimestampBN()];

      expect(await votingLockup.totalSupply()).eq(0n);
      expect(await votingLockup.balanceOf(alice.address)).eq(0n);
      expect(await votingLockup.balanceOf(bob.address)).eq(0n);

      /**
       * END OF INTERACTION
       * BEGIN HISTORICAL ANALYSIS USING BALANCEOFAT
       */
      expect(
        await votingLockup.balanceOfAt(
          alice.address,
          stages.before_deposits[0],
        ),
      ).eq(0n);
      expect(
        await votingLockup.balanceOfAt(bob.address, stages.before_deposits[0]),
      ).eq(0n);
      expect(await votingLockup.totalSupplyAt(stages.before_deposits[0])).eq(
        0n,
      );

      wAlice = await votingLockup.balanceOfAt(
        alice.address,
        stages.alice_deposit[0],
      );
      assertBNClosePercent(
        wAlice,
        (amount / MAXTIME) * (ONE_WEEK - ONE_HOUR),
        tolerance,
      );
      expect(
        await votingLockup.balanceOfAt(bob.address, stages.alice_deposit[0]),
      ).eq(0n);
      wTotal = await votingLockup.totalSupplyAt(stages.alice_deposit[0]);
      expect(wAlice).eq(wTotal);

      for (let i = 0n; i < BigInt(stages.alice_in_0.length); i += 1n) {
        const [block] = stages.alice_in_0[Number(i)];
        wAlice = await votingLockup.balanceOfAt(alice.address, block);
        wBob = await votingLockup.balanceOfAt(bob.address, block);
        wTotal = await votingLockup.totalSupplyAt(block);
        expect(wBob).eq(0n);
        expect(wAlice).eq(wTotal);
        const timeLeft = (ONE_WEEK * (7n - i)) / 7n - ONE_HOUR * 2n;
        const error1h = (ONE_HOUR * 100n) / timeLeft + 1n; // Rounding error of 1 block is possible, and we have 1h blocks
        assertBNClosePercent(
          wAlice,
          (amount / MAXTIME) * timeLeft,
          error1h.toString(),
        );
      }

      wTotal = await votingLockup.totalSupplyAt(stages.alice_withdraw[0]);
      wAlice = await votingLockup.balanceOfAt(
        alice.address,
        stages.alice_withdraw[0],
      );
      wBob = await votingLockup.balanceOfAt(
        bob.address,
        stages.alice_withdraw[0],
      );
      expect(wTotal).eq(0n);
      expect(wAlice).eq(0n);
      expect(wBob).eq(0n);

      wTotal = await votingLockup.totalSupplyAt(stages.alice_deposit_2[0]);
      wAlice = await votingLockup.balanceOfAt(
        alice.address,
        stages.alice_deposit_2[0],
      );
      wBob = await votingLockup.balanceOfAt(
        bob.address,
        stages.alice_deposit_2[0],
      );
      assertBNClosePercent(
        wTotal,
        (amount / MAXTIME) * 2n * ONE_WEEK,
        tolerance,
      );
      expect(wTotal).eq(wAlice);
      expect(wBob).eq(0n);

      wTotal = await votingLockup.totalSupplyAt(stages.bob_deposit_2[0]);
      wAlice = await votingLockup.balanceOfAt(
        alice.address,
        stages.bob_deposit_2[0],
      );
      wBob = await votingLockup.balanceOfAt(
        bob.address,
        stages.bob_deposit_2[0],
      );
      expect(wTotal).eq(wAlice + wBob);
      assertBNClosePercent(
        wTotal,
        (amount / MAXTIME) * 3n * ONE_WEEK,
        tolerance,
      );
      assertBNClosePercent(
        wAlice,
        (amount / MAXTIME) * 2n * ONE_WEEK,
        tolerance,
      );

      let error1h = 0n;
      [, t0] = stages.bob_deposit_2;
      for (let i = 0n; i < BigInt(stages.alice_bob_in_2.length); i += 1n) {
        const [block, ts] = stages.alice_bob_in_2[Number(i)];
        wAlice = await votingLockup.balanceOfAt(alice.address, block);
        wBob = await votingLockup.balanceOfAt(bob.address, block);
        wTotal = await votingLockup.totalSupplyAt(block);
        expect(wTotal).eq(wAlice + wBob);
        dt = ts - t0;
        error1h = (ONE_HOUR * 100n) / (2n * ONE_WEEK - i - ONE_DAY) + 1n;
        assertBNClosePercent(
          wAlice,
          (amount / MAXTIME) * maximum(ONE_WEEK * 2n - dt, 0n),
          error1h.toString(),
        );
        assertBNClosePercent(
          wBob,
          (amount / MAXTIME) * maximum(ONE_WEEK - dt, 0n),
          error1h.toString(),
        );
      }
      wTotal = await votingLockup.totalSupplyAt(stages.bob_withdraw_1[0]);
      wAlice = await votingLockup.balanceOfAt(
        alice.address,
        stages.bob_withdraw_1[0],
      );
      wBob = await votingLockup.balanceOfAt(
        bob.address,
        stages.bob_withdraw_1[0],
      );
      expect(wTotal).eq(wAlice);
      assertBNClosePercent(
        wTotal,
        (amount / MAXTIME) * (ONE_WEEK - ONE_HOUR * 2n),
        tolerance,
      );
      expect(wBob).eq(0n);
      [, t0] = stages.bob_withdraw_1;
      for (let i = 0n; i < BigInt(stages.alice_in_2.length); i += 1n) {
        const [block, ts] = stages.alice_in_2[Number(i)];
        wAlice = await votingLockup.balanceOfAt(alice.address, block);
        wBob = await votingLockup.balanceOfAt(bob.address, block);
        wTotal = await votingLockup.totalSupplyAt(block);
        expect(wTotal).eq(wAlice);
        expect(wBob).eq(0n);
        dt = ts - t0;
        error1h = (ONE_HOUR * 100n) / (ONE_WEEK - i * ONE_DAY + ONE_DAY) + 1n;
        assertBNClosePercent(
          wTotal,
          (amount / MAXTIME) * maximum(ONE_WEEK - dt - ONE_HOUR * 2n, 0n),
          error1h.toString(),
        );
      }
      wTotal = await votingLockup.totalSupplyAt(stages.bob_withdraw_2[0]);
      wAlice = await votingLockup.balanceOfAt(
        alice.address,
        stages.bob_withdraw_2[0],
      );
      wBob = await votingLockup.balanceOfAt(
        bob.address,
        stages.bob_withdraw_2[0],
      );
      expect(wTotal).eq(0n);
      expect(wAlice).eq(0n);
      expect(wBob).eq(0n);
    });
  });
});
