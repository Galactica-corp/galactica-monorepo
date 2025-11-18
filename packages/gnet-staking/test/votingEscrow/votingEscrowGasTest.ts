/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/naming-convention */
import { network, ethers } from "hardhat";
import { expect } from "chai";
import { assertBNClose, assertBNClosePercent } from "./helpers/assertions";
//import { MassetMachine, StandardAccounts } from "./utils/machines"
import {
  advanceBlock,
  increaseTime,
  increaseTimeTo,
  getTimestamp,
  latestBlock,
} from "./helpers/time2";
import { BN, simpleToExactAmount, maximum, sqrt } from "./helpers/math";
import {
  ONE_WEEK,
  ONE_HOUR,
  ONE_DAY,
  ONE_YEAR,
  DEFAULT_DECIMALS,
} from "./helpers/constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { waffle } from "hardhat";
import { MockERC20, VotingEscrow } from "../../typechain";
import { BigNumber, BigNumberish } from "ethers";
import { advanceBlocks, getBlock } from "./helpers/time";
import { MockProvider } from "ethereum-waffle";

let votingLockup: VotingEscrow;
let admin: SignerWithAddress;
let defaultUser: SignerWithAddress;
let other: SignerWithAddress;
let fundManager: SignerWithAddress;
let accounts: SignerWithAddress[];
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let charlie: SignerWithAddress;
let david: SignerWithAddress;
let eve: SignerWithAddress;
let treasury: SignerWithAddress;
//let nexus: Nexus
let govMock: MockERC20;
async function latestBlockBN() {
  return (await ethers.provider.getBlock("latest")).number;
}
async function getTimestampBN() {
  return (await ethers.provider.getBlock("latest")).timestamp;
}

const { provider } = waffle;
describe("Gas usage tests", () => {
  before("Init contract", async () => {
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
    const unixWeekCount = (await getTimestamp()).div(ONE_WEEK);
    const nextUnixWeek = unixWeekCount.add(1).mul(ONE_WEEK);
    await increaseTimeTo(nextUnixWeek);
  };

  const deployFresh = async (initialRewardFunding = BN.from(0)) => {
    //  nexus = await new Nexus__factory(defaultUser).deploy(sa.governor.address)
    const govMockDeployer = await ethers.getContractFactory("MockERC20", admin);

    govMock = await govMockDeployer.deploy("FiatDAO", "Token", admin.address);
    // mta = await new MintableToken__factory(defaultUser).deploy(nexus.address, sa.fundManager.address)
    await govMock.mint(
      fundManager.address,
      ethers.utils.parseEther("1000000000000")
    );

    await govMock
      .connect(fundManager)
      .transfer(
        defaultUser.address,
        simpleToExactAmount(1000, DEFAULT_DECIMALS)
      );
    await govMock
      .connect(fundManager)
      .transfer(other.address, simpleToExactAmount(1000, DEFAULT_DECIMALS));

    const votingEscrowDeployer = await ethers.getContractFactory(
      "VotingEscrow",
      admin
    );
    votingLockup = await votingEscrowDeployer.deploy(
      admin.address,
      treasury.address,
      govMock.address,
      "veToken",
      "veToken"
    );
    await govMock.approve(
      votingLockup.address,
      simpleToExactAmount(100, DEFAULT_DECIMALS)
    );
    await govMock
      .connect(other)
      .approve(
        votingLockup.address,
        simpleToExactAmount(100, DEFAULT_DECIMALS)
      );
    await govMock
      .connect(fundManager)
      .approve(
        votingLockup.address,
        simpleToExactAmount(10000, DEFAULT_DECIMALS)
      );
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
      senderStakingTokenBalance: await govMock.balanceOf(sender.address),
      contractStakingTokenBalance: await govMock.balanceOf(
        votingLockup.address
      ),
      votingPower: await votingLockup.balanceOf(sender.address),
    };
  };

  describe("Start gas consumption comparison", () => {
    const stakeAmt1 = simpleToExactAmount(10, DEFAULT_DECIMALS);
    const stakeAmt2 = simpleToExactAmount(1000, DEFAULT_DECIMALS);
    let start: BigNumber;
    let maxTime: BigNumber;
    beforeEach(async () => {
      await goToNextUnixWeekStart();

      await deployFresh(simpleToExactAmount(100, DEFAULT_DECIMALS));
      maxTime = await votingLockup.MAXTIME();
      await govMock
        .connect(fundManager)
        .transfer(alice.address, simpleToExactAmount(1, 22));
      await govMock
        .connect(fundManager)
        .transfer(bob.address, simpleToExactAmount(1, 22));
      await govMock
        .connect(fundManager)
        .transfer(charlie.address, simpleToExactAmount(1, 22));
      await govMock
        .connect(fundManager)
        .transfer(david.address, simpleToExactAmount(1, 22));
      await govMock
        .connect(fundManager)
        .transfer(eve.address, simpleToExactAmount(1, 22));
      await govMock
        .connect(alice)
        .approve(votingLockup.address, simpleToExactAmount(100, 21));
      await govMock
        .connect(bob)
        .approve(votingLockup.address, simpleToExactAmount(100, 21));
      await govMock
        .connect(charlie)
        .approve(votingLockup.address, simpleToExactAmount(100, 21));
      await govMock
        .connect(david)
        .approve(votingLockup.address, simpleToExactAmount(100, 21));
      await govMock
        .connect(eve)
        .approve(votingLockup.address, simpleToExactAmount(100, 21));
    });

    const calcBias = (amount: BN, len: BN): BN => amount.div(maxTime).mul(len);

    describe("Gas usage", () => {
      it("Alice, Bob and Charlie create MAX locks and withdraw RIGHT AFTER their locked expired, no delegation, nor global checkpoint", async () => {
        start = await getTimestamp();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(bob)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(charlie)
          .createLock(stakeAmt1, start.add(ONE_YEAR));

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
            .add(bobData.votingPower)
            .add(charlieData.votingPower)
        );

        // NOTHING HAPPENS FOR 1 YEAR.. NOT EVEN A GLOBAL CHECKPOINT
        await increaseTime(ONE_YEAR);

        // Gas for withdraw for the first user is very high because there are no previous global checkpoint (last was 1 year ago)
        //  first withdraw : ~4M
        await votingLockup.connect(alice).withdraw();
        // New withdraws are cheaper ~160K
        await votingLockup.connect(bob).withdraw();
        await votingLockup.connect(charlie).withdraw();
      });
      it("Alice, Bob and Charlie create locks and withdraw RIGHT AFTER their locked expired, no delegation but WE DID 1 GLOBAL CHECKPOINT at 3 months", async () => {
        start = await getTimestamp();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(bob)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(charlie)
          .createLock(stakeAmt1, start.add(ONE_YEAR));

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
            .add(bobData.votingPower)
            .add(charlieData.votingPower)
        );

        await increaseTime(ONE_WEEK.mul(13));
        // 3 months later
        // This call costs ~1M
        await votingLockup.checkpoint();

        await increaseTime(ONE_WEEK.mul(39));

        // Gas for withdraw for the first user is very high because there are no previous global checkpoint (last was 6 month ago)
        //  first withdraw : ~3 M
        await votingLockup.connect(alice).withdraw();

        // NOTE that gas cost for checkpoint() + alice withdraw equals roughly as alice's withdraw in previous test without global checkpoint

        // New withdraws are again cheaper ~160k
        await votingLockup.connect(bob).withdraw();
        await votingLockup.connect(charlie).withdraw();
      });
      it("Alice, Bob and Charlie create locks and withdraw RIGHT AFTER their locked expired, no delegation but WE DID 2 GLOBAL CHECKPOINTS at 3 and 9 months", async () => {
        start = await getTimestamp();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(bob)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(charlie)
          .createLock(stakeAmt1, start.add(ONE_YEAR));

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
            .add(bobData.votingPower)
            .add(charlieData.votingPower)
        );

        await increaseTime(ONE_WEEK.mul(13));
        // 3 months later
        // This call costs ~1M
        await votingLockup.checkpoint();

        await increaseTime(ONE_WEEK.mul(13)); // roughly 6 month from deposit

        await increaseTime(ONE_WEEK.mul(13));

        // 6 month from latest checkpoint
        // This call costs ~2M
        await votingLockup.checkpoint();
        await increaseTime(ONE_WEEK.mul(13)); // lock expired after 1 year

        // Gas for withdraw in this case is 1M
        //  first withdraw : ~1 M
        await votingLockup.connect(alice).withdraw();

        // NOTE that gas cost for the 2 checkpoint() + alice withdraw equals roughly as alice's withdraw in previous test without global checkpoint (~4M)

        // New withdraws are again cheaper ~160k
        await votingLockup.connect(bob).withdraw();
        await votingLockup.connect(charlie).withdraw();
      });
      it("Alice, Bob and Charlie create locks and withdraw RIGHT AFTER their locked expired, no delegation but WE DID 3 GLOBAL CHECKPOINTS at 3,9 and 12 months", async () => {
        start = await getTimestamp();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(bob)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(charlie)
          .createLock(stakeAmt1, start.add(ONE_YEAR));

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
            .add(bobData.votingPower)
            .add(charlieData.votingPower)
        );

        await increaseTime(ONE_WEEK.mul(13));
        // 3 months later
        // This call costs ~1M
        await votingLockup.checkpoint();

        await increaseTime(ONE_WEEK.mul(13)); // roughly 6 month from deposit

        await increaseTime(ONE_WEEK.mul(13));

        // 6 month from latest checkpoint
        // This call costs ~2M
        await votingLockup.checkpoint();
        await increaseTime(ONE_WEEK.mul(13)); // lock expired after 1 year

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
        start = await getTimestamp();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(bob)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(charlie)
          .createLock(stakeAmt1, start.add(ONE_YEAR));

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
            .add(bobData.votingPower)
            .add(charlieData.votingPower)
        );

        // NOTHING HAPPENS FOR 1 YEAR.. NOT EVEN A GLOBAL CHECKPOINT
        await increaseTime(ONE_YEAR);

        // David creates a new lock right after a year
        // This call costs roughly ~4M (no checkpoint for a year)
        await votingLockup
          .connect(david)
          .createLock(stakeAmt1, (await getTimestamp()).add(ONE_YEAR));

        await increaseTime(ONE_WEEK); // New weekly checkpoint available
        // This one costs 254K
        await votingLockup.connect(alice).withdraw();
        // New withdraws are cheaper ~180K
        await votingLockup.connect(charlie).withdraw();

        await increaseTime(ONE_WEEK);
        // This one costs 254K, each week increases ~70k, the other withdraws in the same week are at 180K
        await votingLockup.connect(bob).withdraw();
      });
      it("Alice, Bob and Charlie create locks, Bob inmediately locks to Alice, Charlie after 3 months", async () => {
        start = await getTimestamp();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(bob)
          .createLock(stakeAmt1, start.add(ONE_WEEK.mul(26)));
        await votingLockup
          .connect(charlie)
          .createLock(stakeAmt1, start.add(ONE_WEEK.mul(26)));

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
            .add(bobData.votingPower)
            .add(charlieData.votingPower)
        );

        // Bob inmediately locks
        // This costs 343K
        await votingLockup.connect(bob).delegate(alice.address);

        // After 3 months charlie delegates to Alice too
        await increaseTime(ONE_WEEK.mul(12));

        // Charlie locks after 90 days without global checkpoint
        // This costs 1.2M ==> in line with 10K increase at the checkpoint, even if there are 2 checkpoints because are in the same week
        await votingLockup.connect(charlie).delegate(alice.address);
      });
      it("Alice, Bob and Charlie create locks, Bob inmediately locks to Alice, Checkpoint after 6 months", async () => {
        start = await getTimestamp();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(bob)
          .createLock(stakeAmt1, start.add(ONE_WEEK.mul(26)));
        await votingLockup
          .connect(charlie)
          .createLock(stakeAmt1, start.add(ONE_WEEK.mul(26)));

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
            .add(bobData.votingPower)
            .add(charlieData.votingPower)
        );

        // Bob inmediately locks
        // This costs 343K
        await votingLockup.connect(bob).delegate(alice.address);

        // After 3 months we make a checkpoint
        await increaseTime(ONE_WEEK.mul(12));
        // This one costs 945K for 3 months
        await votingLockup.checkpoint();

        // After 3 months charlie delegates to Alice too
        await increaseTime(ONE_WEEK.mul(12));

        // Charlie delegate after 84 days without global checkpoint
        // This costs ~1.2M ==> in line with ~10K increase at the checkpoint, even if there are 2 checkpoints because are in the same week
        await votingLockup.connect(charlie).delegate(alice.address);
      });
      it("Alice, Bob and Charlie inmediately locks to Alice, then Charlie first increase lock time then undelegates, after checkpoint Bob delegates to Charlie ", async () => {
        start = await getTimestamp();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(bob)
          .createLock(stakeAmt1, start.add(ONE_WEEK.mul(26)));
        await votingLockup
          .connect(charlie)
          .createLock(stakeAmt1, start.add(ONE_WEEK.mul(26)));

        const aliceData = await snapshotData(alice);
        const bobData = await snapshotData(bob);
        const charlieData = await snapshotData(charlie);

        // Total supply is the sum of their voting power
        expect(await votingLockup.totalSupply()).to.equal(
          aliceData.votingPower
            .add(bobData.votingPower)
            .add(charlieData.votingPower)
        );

        // Bob inmediately locks
        // This costs 343K
        await votingLockup.connect(bob).delegate(alice.address);
        await votingLockup.connect(charlie).delegate(alice.address);

        // After 3 months
        await increaseTime(ONE_WEEK.mul(12));
        // This call cost 1M (updates the global checkpoint)
        await votingLockup
          .connect(charlie)
          .increaseUnlockTime((await getTimestamp()).add(ONE_YEAR));
        // This one costs ~340K
        await votingLockup.connect(charlie).delegate(charlie.address);
        await increaseTime(ONE_YEAR);
        await votingLockup.checkpoint();
        await votingLockup.connect(charlie).withdraw();
        // After 3 months we make a checkpoint

        await votingLockup.checkpoint();

        // This one costs ~340K
        // await votingLockup.connect(bob).delegate(charlie.address);
      });
      it("Alice locks, then increase amount, increase lock time and quitLocks ", async () => {
        start = await getTimestamp();
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(stakeAmt1, start.add(ONE_WEEK));

        await votingLockup.connect(alice).increaseAmount(stakeAmt1);
        await votingLockup
          .connect(alice)
          .increaseUnlockTime((await getTimestamp()).add(ONE_YEAR));

        // Alice's quitLocks
        await votingLockup.connect(alice).quitLock();
      });
    });

    // We could estimate that if no global checkpoint are made (either calling directly or by depositing,withdrawing etc),
    // the gas cost for creating lock, delegating, withdrawing, quitLock, increasing amount or unlock time increases ~70K per week
  });
});
