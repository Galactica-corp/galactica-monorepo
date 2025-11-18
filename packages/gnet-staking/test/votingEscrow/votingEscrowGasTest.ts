/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/naming-convention */
import { network, ethers, ignition } from 'hardhat';
import { expect } from 'chai';
import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { assertBNClose, assertBNClosePercent } from './helpers/assertions';
import { BN, simpleToExactAmount, maximum, sqrt } from './helpers/math';
import {
  ONE_WEEK,
  ONE_HOUR,
  ONE_DAY,
  ONE_YEAR,
  DEFAULT_DECIMALS,
} from './helpers/constants';
import type { VotingEscrow } from '../../typechain-types/contracts/VotingEscrow';
import votingEscrowModule from '../../ignition/modules/VotingEscrow.m';

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
let treasury: any;

async function latestBlockBN() {
  return BigInt((await ethers.provider.getBlock('latest'))!.number);
}
async function getTimestampBN() {
  return BigInt((await ethers.provider.getBlock('latest'))!.timestamp);
}

describe('Gas usage tests', () => {
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
      treasury,
    ] = accounts;
  });

  const goToNextUnixWeekStart = async () => {
    const currentTimestamp = BigInt(await getTimestampBN());
    const unixWeekCount = currentTimestamp / ONE_WEEK;
    const nextUnixWeek = (unixWeekCount + 1n) * ONE_WEEK;
    await time.increaseTo(nextUnixWeek);
  };

  const deployFresh = async (initialRewardFunding = 0n) => {
    const { votingEscrow } = await ignition.deploy(votingEscrowModule, {
      parameters: {
        VotingEscrowModule: {
          owner: admin.address,
          penaltyRecipient: treasury.address,
          name: 'veToken',
          symbol: 'veToken',
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
      '0x' + ethers.parseEther('1000000000000').toString(16),
    ]);
    await ethers.provider.send('hardhat_setBalance', [
      defaultUser.address,
      '0x' + simpleToExactAmount(1000, DEFAULT_DECIMALS).toString(16),
    ]);
    await ethers.provider.send('hardhat_setBalance', [
      other.address,
      '0x' + simpleToExactAmount(1000, DEFAULT_DECIMALS).toString(16),
    ]);
  };

  interface LockedBalance {
    amount: BN;
    delegated: BN;
    end: BN;
    delegatee: string;
  }

  interface Point {
    bias: BN;
    slope: BN;
    ts: BN;
    blk?: BN;
  }

  interface ContractData {
    epoch: BN;
    userEpoch: BN;
    userLocked: LockedBalance;
    userLastPoint: Point;
    lastPoint: Point;
    senderStakingTokenBalance: BN;
    contractStakingTokenBalance: BN;
    votingPower: BN;
  }

  const snapshotData = async (sender = defaultUser): Promise<ContractData> => {
    const locked = await votingLockup.locked(sender.address);
    const userLastPoint = await votingLockup.getLastUserPoint(sender.address);
    const epoch = await await votingLockup.globalEpoch();
    const userEpoch = await await votingLockup.userPointEpoch(sender.address);
    const lastPoint = await votingLockup.pointHistory(epoch);
    const balanceOf = await votingLockup.balanceOf(sender.address);
    return {
      epoch,
      userEpoch,
      userLocked: {
        amount: locked[0],
        delegated: locked[1],
        end: locked[2],
        delegatee: locked[3],
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
      senderStakingTokenBalance: await ethers.provider.getBalance(sender.address),
      contractStakingTokenBalance: await ethers.provider.getBalance(
        await votingLockup.getAddress()
      ),
      votingPower: await votingLockup.balanceOf(sender.address),
    };
  };

  describe("Start gas consumption comparison", () => {
    const stakeAmt1 = simpleToExactAmount(10, DEFAULT_DECIMALS);
    const stakeAmt2 = simpleToExactAmount(1000, DEFAULT_DECIMALS);
    let start: bigint;
    let maxTime: bigint;
    beforeEach(async () => {
      await goToNextUnixWeekStart();

      await deployFresh(simpleToExactAmount(100, DEFAULT_DECIMALS));
      maxTime = await votingLockup.MAXTIME();
      // Fund accounts with native tokens
      await ethers.provider.send('hardhat_setBalance', [
        alice.address,
        '0x' + simpleToExactAmount(1, 22).toString(16),
      ]);
      await ethers.provider.send('hardhat_setBalance', [
        bob.address,
        '0x' + simpleToExactAmount(1, 22).toString(16),
      ]);
      await ethers.provider.send('hardhat_setBalance', [
        charlie.address,
        '0x' + simpleToExactAmount(1, 22).toString(16),
      ]);
      await ethers.provider.send('hardhat_setBalance', [
        david.address,
        '0x' + simpleToExactAmount(1, 22).toString(16),
      ]);
      await ethers.provider.send('hardhat_setBalance', [
        eve.address,
        '0x' + simpleToExactAmount(1, 22).toString(16),
      ]);
    });

    const calcBias = (amount: BN, len: BN): BN => amount / maxTime * len;

    describe("Gas usage", () => {
      it("Alice, Bob and Charlie create MAX locks and withdraw RIGHT AFTER their locked expired, no delegation, nor global checkpoint", async () => {
        start = await getTimestampBN();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(bob)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(charlie)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
          + bobData.votingPower
          + charlieData.votingPower
        );

        // NOTHING HAPPENS FOR 1 YEAR.. NOT EVEN A GLOBAL CHECKPOINT
        await time.increase(ONE_YEAR);

        // Gas for withdraw for the first user is very high because there are no previous global checkpoint (last was 1 year ago)
        //  first withdraw : ~4M
        await votingLockup.connect(alice).withdraw();
        // New withdraws are cheaper ~160K
        await votingLockup.connect(bob).withdraw();
        await votingLockup.connect(charlie).withdraw();
      });
      it("Alice, Bob and Charlie create locks and withdraw RIGHT AFTER their locked expired, no delegation but WE DID 1 GLOBAL CHECKPOINT at 3 months", async () => {
        start = await getTimestampBN();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(bob)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(charlie)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
          + bobData.votingPower
          + charlieData.votingPower
        );

        await time.increase(ONE_WEEK * 13n);
        // 3 months later
        // This call costs ~1M
        await votingLockup.checkpoint();

        await time.increase(ONE_WEEK * 39n);

        // Gas for withdraw for the first user is very high because there are no previous global checkpoint (last was 6 month ago)
        //  first withdraw : ~3 M
        await votingLockup.connect(alice).withdraw();

        // NOTE that gas cost for checkpoint() + alice withdraw equals roughly as alice's withdraw in previous test without global checkpoint

        // New withdraws are again cheaper ~160k
        await votingLockup.connect(bob).withdraw();
        await votingLockup.connect(charlie).withdraw();
      });
      it("Alice, Bob and Charlie create locks and withdraw RIGHT AFTER their locked expired, no delegation but WE DID 2 GLOBAL CHECKPOINTS at 3 and 9 months", async () => {
        start = await getTimestampBN();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(bob)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(charlie)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
          + bobData.votingPower
          + charlieData.votingPower
        );

        await time.increase(ONE_WEEK * 13n);
        // 3 months later
        // This call costs ~1M
        await votingLockup.checkpoint();

        await time.increase(ONE_WEEK * 13n); // roughly 6 month from deposit

        await time.increase(ONE_WEEK * 13n);

        // 6 month from latest checkpoint
        // This call costs ~2M
        await votingLockup.checkpoint();
        await time.increase(ONE_WEEK * 13n); // lock expired after 1 year

        // Gas for withdraw in this case is 1M
        //  first withdraw : ~1 M
        await votingLockup.connect(alice).withdraw();

        // NOTE that gas cost for the 2 checkpoint() + alice withdraw equals roughly as alice's withdraw in previous test without global checkpoint (~4M)

        // New withdraws are again cheaper ~160k
        await votingLockup.connect(bob).withdraw();
        await votingLockup.connect(charlie).withdraw();
      });
      it("Alice, Bob and Charlie create locks and withdraw RIGHT AFTER their locked expired, no delegation but WE DID 3 GLOBAL CHECKPOINTS at 3,9 and 12 months", async () => {
        start = await getTimestampBN();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(bob)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(charlie)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
          + bobData.votingPower
          + charlieData.votingPower
        );

        await time.increase(ONE_WEEK * 13n);
        // 3 months later
        // This call costs ~1M
        await votingLockup.checkpoint();

        await time.increase(ONE_WEEK * 13n); // roughly 6 month from deposit

        await time.increase(ONE_WEEK * 13n);

        // 6 month from latest checkpoint
        // This call costs ~2M
        await votingLockup.checkpoint();
        await time.increase(ONE_WEEK * 13n); // lock expired after 1 year

        // 3 months after latest checkpoint
        // This call costs ~1M
        await votingLockup.checkpoint();

        // NOTE that gas cost for the 3 checkpoint() + alice withdraw equals roughly as alice's withdraw in previous test without global checkpoint (~4M)

        // All withdraws are again cheaper ~160k
        await votingLockup.connect(alice).withdraw();
        await votingLockup.connect(bob).withdraw();
        await votingLockup.connect(charlie).withdraw();
      });
      it("Alice, Bob and Charlie create MAX locks and withdraw RIGHT AFTER their locked expired, no delegation, 1 global checkpoint made from david", async () => {
        start = await getTimestampBN();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(bob)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(charlie)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
          + bobData.votingPower
          + charlieData.votingPower
        );

        // NOTHING HAPPENS FOR 1 YEAR.. NOT EVEN A GLOBAL CHECKPOINT
        await time.increase(ONE_YEAR);

        // David creates a new lock right after a year
        // This call costs roughly ~4M (no checkpoint for a year)
        await votingLockup
          .connect(david)
          .createLock(await getTimestampBN() + ONE_YEAR, { value: stakeAmt1 });

        await time.increase(ONE_WEEK); // New weekly checkpoint available
        // This one costs 254K
        await votingLockup.connect(alice).withdraw();
        // New withdraws are cheaper ~180K
        await votingLockup.connect(charlie).withdraw();

        await time.increase(ONE_WEEK);
        // This one costs 254K, each week increases ~70k, the other withdraws in the same week are at 180K
        await votingLockup.connect(bob).withdraw();
      });
      it("Alice, Bob and Charlie create locks, Bob inmediately locks to Alice, Charlie after 3 months", async () => {
        start = await getTimestampBN();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(bob)
          .createLock(start + ONE_WEEK * 26n, { value: stakeAmt1 });
        await votingLockup
          .connect(charlie)
          .createLock(start + ONE_WEEK * 26n, { value: stakeAmt1 });

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
          + bobData.votingPower
          + charlieData.votingPower
        );

        // Bob inmediately locks
        // This costs 343K
        await votingLockup.connect(bob).delegate(alice.address);

        // After 3 months charlie delegates to Alice too
        await time.increase(ONE_WEEK * 12n);

        // Charlie locks after 90 days without global checkpoint
        // This costs 1.2M ==> in line with 10K increase at the checkpoint, even if there are 2 checkpoints because are in the same week
        await votingLockup.connect(charlie).delegate(alice.address);
      });
      it("Alice, Bob and Charlie create locks, Bob inmediately locks to Alice, Checkpoint after 6 months", async () => {
        start = await getTimestampBN();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(bob)
          .createLock(start + ONE_WEEK * 26n, { value: stakeAmt1 });
        await votingLockup
          .connect(charlie)
          .createLock(start + ONE_WEEK * 26n, { value: stakeAmt1 });

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
          + bobData.votingPower
          + charlieData.votingPower
        );

        // Bob inmediately locks
        // This costs 343K
        await votingLockup.connect(bob).delegate(alice.address);

        // After 3 months we make a checkpoint
        await time.increase(ONE_WEEK * 12n);
        // This one costs 945K for 3 months
        await votingLockup.checkpoint();

        // After 3 months charlie delegates to Alice too
        await time.increase(ONE_WEEK * 12n);

        // Charlie delegate after 84 days without global checkpoint
        // This costs ~1.2M ==> in line with ~10K increase at the checkpoint, even if there are 2 checkpoints because are in the same week
        await votingLockup.connect(charlie).delegate(alice.address);
      });
      it("Alice, Bob and Charlie inmediately locks to Alice, then Charlie first increase lock time then undelegates, after checkpoint Bob delegates to Charlie ", async () => {
        start = await getTimestampBN();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(start + ONE_YEAR, { value: stakeAmt1 });
        await votingLockup
          .connect(bob)
          .createLock(start + ONE_WEEK * 26n, { value: stakeAmt1 });
        await votingLockup
          .connect(charlie)
          .createLock(start + ONE_WEEK * 26n, { value: stakeAmt1 });

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
          + bobData.votingPower
          + charlieData.votingPower
        );

        // Bob inmediately locks
        // This costs 343K
        await votingLockup.connect(bob).delegate(alice.address);
        await votingLockup.connect(charlie).delegate(alice.address);

        // After 3 months
        await time.increase(ONE_WEEK * 12n);
        // This call cost 1M (updates the global checkpoint)
        await votingLockup
          .connect(charlie)
          .increaseUnlockTime(await getTimestampBN() + ONE_YEAR);
        // This one costs ~340K
        await votingLockup.connect(charlie).delegate(charlie.address);
        await time.increase(ONE_YEAR);
        await votingLockup.checkpoint();
        await votingLockup.connect(charlie).withdraw();
        // After 3 months we make a checkpoint

        await votingLockup.checkpoint();

        // This one costs ~340K
        // await votingLockup.connect(bob).delegate(charlie.address);
      });
      it("Alice locks, then increase amount, increase lock time and quitLocks ", async () => {
        start = await getTimestampBN();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(start + ONE_WEEK, { value: stakeAmt1 });

        await votingLockup.connect(alice).increaseAmount({ value: stakeAmt1 });
        await votingLockup
          .connect(alice)
          .increaseUnlockTime(await getTimestampBN() + ONE_YEAR);

        // Alice's quitLocks
        await votingLockup.connect(alice).quitLock();
      });
    });

    // We could estimate that if no global checkpoint are made (either calling directly or by depositing,withdrawing etc),
    // the gas cost for creating lock, delegating, withdrawing, quitLock, increasing amount or unlock time increases ~70K per week
  });
});
