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
//import { ethers, waffle, network } from "hardhat";
import { MockERC20, VotingEscrow } from "../../typechain";
import { BigNumber, BigNumberish } from "ethers";
import { getBlock } from "./helpers/time";
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

describe("VotingEscrow Delegation Math test", () => {
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

  describe("performing delegation flow", () => {
    const stakeAmt1 = simpleToExactAmount(10, DEFAULT_DECIMALS);
    const stakeAmt2 = simpleToExactAmount(1000, DEFAULT_DECIMALS);
    let start: BigNumber;
    let maxTime: BigNumber;
    before(async () => {
      await goToNextUnixWeekStart();
      start = await getTimestamp();
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

    describe("creating a lockup", () => {
      it("Alice, Bob and Charlie create initial locks", async () => {
        // Total supply (total voting power) is ZERO
        expect(await votingLockup.totalSupply()).to.equal(0);

        await votingLockup
          .connect(alice)
          .createLock(stakeAmt1, start.add(ONE_YEAR));
        await votingLockup
          .connect(bob)
          .createLock(stakeAmt2, start.add(ONE_WEEK.mul(26)));
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

        // Bias
        assertBNClosePercent(
          aliceData.userLastPoint.bias,
          calcBias(stakeAmt1, ONE_YEAR),
          "0.4"
        );
        assertBNClosePercent(
          bobData.userLastPoint.bias,
          calcBias(stakeAmt2, ONE_WEEK.mul(26)),
          "0.4"
        );
        assertBNClosePercent(
          charlieData.userLastPoint.bias,
          calcBias(stakeAmt1, ONE_WEEK.mul(26)),
          "0.4"
        );
      });
    });

    describe("delegating lock", () => {
      describe("Fails if conditions are not met, Charlie delegates to Alice", () => {
        it("Alice fails to delegate to Charlie because Charlie's lock is shorter", async () => {
          expect(
            await votingLockup.balanceOfAt(alice.address, await latestBlockBN())
          ).to.be.above(0);

          await expect(
            votingLockup.connect(alice).delegate(bob.address)
          ).to.be.revertedWith("Only delegate to longer lock");

          expect(
            await votingLockup.balanceOfAt(alice.address, await latestBlockBN())
          ).to.be.above(0);

          const aliceData = await snapshotData(alice);
          assertBNClosePercent(
            aliceData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_YEAR),
            "0.4"
          );
        });
        it("Charlie delegates to Alice but fails to re-delegate to Bob because bob's lock is shorter than Alice's", async () => {
          const charlieVP = await votingLockup.balanceOf(charlie.address); // 6 month lock - stakeAmt1
          const aliceVP = await votingLockup.balanceOf(alice.address); // 1 year lock - stakeAmt1
          const bobVP = await votingLockup.balanceOf(bob.address); // 6 month - stakeAmt2

          const totalSupplyBefore = await votingLockup.totalSupply();
          // Delegating lock
          await votingLockup.connect(charlie).delegate(alice.address);

          // Alice's voting power is her one plus twice the original charlie vp (passed from 6 month to 1 year)
          assertBNClosePercent(
            charlieVP.mul(2).add(aliceVP),
            await votingLockup.balanceOf(alice.address),
            "0.4"
          );

          // Total supply also increased
          assertBNClosePercent(
            charlieVP.mul(2).add(bobVP).add(aliceVP),
            await votingLockup.totalSupply(),
            "0.4"
          );

          // Charlie has no voting power
          expect(
            await votingLockup.balanceOfAt(
              charlie.address,
              await latestBlockBN()
            )
          ).to.equal(0);

          // Alice now has also charlie staked amount
          const aliceData = await snapshotData(alice);
          assertBNClosePercent(
            aliceData.userLastPoint.bias,
            calcBias(stakeAmt1.mul(2), ONE_YEAR),
            "0.4"
          );

          await expect(
            votingLockup.connect(charlie).delegate(bob.address)
          ).to.be.revertedWith("Only delegate to longer lock");

          // Alice still has all the voting power
          const aliceDataAfter = await snapshotData(alice);
          assertBNClosePercent(
            aliceDataAfter.userLastPoint.bias,
            calcBias(stakeAmt1.mul(2), ONE_YEAR),
            "0.4"
          );
        });

        it("Charlie fails to quitLock because he hasn't undelegated yet", async () => {
          await expect(
            votingLockup.connect(charlie).quitLock()
          ).to.be.revertedWith("Lock delegated");

          // Charlie has no voting power
          expect(
            await votingLockup.balanceOfAt(
              charlie.address,
              await latestBlockBN()
            )
          ).to.equal(0);
        });
      });

      describe("Increasing amount or unlock time, Charlie has delegated to Alice", () => {
        it("Charlie increases his lock amount, Alice's voting power increase", async () => {
          // Alice now has also charlie staked amount
          const aliceData = await snapshotData(alice);
          assertBNClosePercent(
            aliceData.userLastPoint.bias,
            calcBias(stakeAmt1.mul(2), ONE_YEAR),
            "0.4"
          );

          // Charlie has no voting power
          expect(
            await votingLockup.balanceOfAt(
              charlie.address,
              await latestBlockBN()
            )
          ).to.equal(0);

          await votingLockup.connect(charlie).increaseAmount(stakeAmt1);

          // Alice has more voting power
          const aliceDataAfter = await snapshotData(alice);
          assertBNClosePercent(
            aliceDataAfter.userLastPoint.bias,
            calcBias(stakeAmt1.mul(3), ONE_YEAR),
            "0.4"
          );

          // Charlie's power is still ZERO
          expect(
            await votingLockup.balanceOfAt(
              charlie.address,
              await latestBlockBN()
            )
          ).to.equal(0);
        });

        it("Charlie extends his lock, then undelegate", async () => {
          await votingLockup
            .connect(charlie)
            .increaseUnlockTime((await getTimestamp()).add(ONE_YEAR));

          // Charlie's power is still ZERO
          expect(
            await votingLockup.balanceOfAt(
              charlie.address,
              await latestBlockBN()
            )
          ).to.equal(0);

          let aliceData = await snapshotData(alice);

          await votingLockup.connect(charlie).delegate(charlie.address);

          // Alice has no more Charlie's voting power
          aliceData = await snapshotData(alice);

          assertBNClosePercent(
            aliceData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_YEAR),
            "0.4"
          );

          // Charlie got his voting power back
          const charlieData = await snapshotData(charlie);
          assertBNClosePercent(
            charlieData.userLastPoint.bias,
            calcBias(stakeAmt1.mul(2), ONE_YEAR),
            "0.4"
          );
        });

        // xit("Charlie quit (he has no delegation in place), fails to re-create a lock because lock is still active", async () => {
        //   await votingLockup.connect(charlie).quitLock();

        //   // Charlie's power is NOW ZERO
        //   expect(
        //     await votingLockup.balanceOfAt(
        //       charlie.address,
        //       await latestBlockBN()
        //     )
        //   ).to.equal(0);

        //   await expect(
        //     votingLockup
        //       .connect(charlie)
        //       .createLock(stakeAmt1, (await getTimestamp()).add(ONE_WEEK))
        //   ).to.be.revertedWith("The lock didn't expire");
        // });

        it("Charlie can still increase lock length", async () => {
          expect(
            await votingLockup.balanceOfAt(
              charlie.address,
              await latestBlockBN()
            )
          ).to.above(0);

          const lockEndBfore = await votingLockup.lockEnd(charlie.address);

          await goToNextUnixWeekStart();

          await votingLockup
            .connect(charlie)
            .increaseUnlockTime((await getTimestamp()).add(ONE_YEAR));

          expect(await votingLockup.lockEnd(charlie.address)).gt(lockEndBfore);
        });

        it("Charlie fails to delegates to Alice again, she has shorter lock", async () => {
          await expect(
            votingLockup.connect(charlie).delegate(alice.address)
          ).to.be.revertedWith("Only delegate to longer lock");
        });

        // REMOVE
        /*it("Alice increase her lock equal to Charlie's one, but yet Charlie cannot delegate", async () => {
          await votingLockup
            .connect(alice)
            .increaseUnlockTime((await getTimestamp()).add(ONE_YEAR));

          await expect(
            votingLockup.connect(charlie).delegate(alice.address)
          ).to.be.revertedWith("Only delegate to longer lock duration");
        });*/

        it("Alice increases her lock one week more than Charlie, Charlie can delegate to Alice", async () => {
          // advance 1 week
          await goToNextUnixWeekStart();

          await votingLockup
            .connect(alice)
            .increaseUnlockTime((await getTimestamp()).add(ONE_YEAR));

          // Alice has only her voting power
          // const aliceData = await snapshotData(alice);
          // assertBNClosePercent(
          //   aliceData.userLastPoint.bias,
          //   calcBias(stakeAmt1, ONE_YEAR),
          //   "0.4"
          // );

          await votingLockup.connect(charlie).delegate(alice.address);

          // Charlie's power is zero
          expect(
            await votingLockup.balanceOfAt(
              charlie.address,
              await latestBlockBN()
            )
          ).to.equal(0);

          // Alice has also Charlie's voting power
          const aliceDataAfter = await snapshotData(alice);
          assertBNClosePercent(
            aliceDataAfter.userLastPoint.bias,
            calcBias(stakeAmt1.mul(3), ONE_YEAR),
            "0.4"
          );
        });

        it("Bob's lock is shorter than Alice's, Charlie cannot delegate to Bob", async () => {
          await expect(
            votingLockup.connect(charlie).delegate(bob.address)
          ).to.be.revertedWith("Only delegate to longer lock");

          // Charlie's power is still zero
          expect(
            await votingLockup.balanceOfAt(
              charlie.address,
              await latestBlockBN()
            )
          ).to.equal(0);
        });

        it("Bob increases his lock beyond Alice's, Charlie now can delegate to Bob", async () => {
          // advance 1 week
          await goToNextUnixWeekStart();

          // Bob's set his unlock time 1 WEEK longer than Alice's.
          await votingLockup
            .connect(bob)
            .increaseUnlockTime((await getTimestamp()).add(ONE_YEAR));

          // Bob has voting power
          const bobData = await snapshotData(bob);
          assertBNClosePercent(
            bobData.userLastPoint.bias,
            calcBias(stakeAmt2, ONE_YEAR),
            "0.4"
          );

          await votingLockup.connect(charlie).delegate(bob.address);

          // Charlie's power is zero
          expect(
            await votingLockup.balanceOfAt(
              charlie.address,
              await latestBlockBN()
            )
          ).to.equal(0);

          // Bob has more voting power
          const bobDataAfter = await snapshotData(bob);
          assertBNClosePercent(
            bobDataAfter.userLastPoint.bias,
            calcBias(stakeAmt2.add(stakeAmt1.mul(2)), ONE_YEAR),
            "0.4"
          );

          // Alice's updates her lock to 1 year, we check she only has her voting power left
          // TODO: check this
          await votingLockup
            .connect(alice)
            .increaseUnlockTime((await getTimestamp()).add(ONE_YEAR));
          // Alice only has her voting power
          const aliceDataAfter = await snapshotData(alice);
          assertBNClosePercent(
            aliceDataAfter.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_YEAR),
            "0.4"
          );
        });
      });

      describe("Re-delegation voting power and lock end accounting", () => {
        it("David and Eve creates locks", async () => {
          await votingLockup
            .connect(david)
            .createLock(stakeAmt1, (await getTimestamp()).add(ONE_YEAR));
          await votingLockup
            .connect(eve)
            .createLock(stakeAmt1, (await getTimestamp()).add(ONE_WEEK));

          const davidData = await snapshotData(david);
          const eveData = await snapshotData(eve);

          assertBNClosePercent(
            davidData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_YEAR),
            "0.4"
          );
          assertBNClosePercent(
            eveData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_WEEK),
            "0.4"
          );
        });
        it("Eve delegates to David, Eve Now inherits 1 year lock from David (from 1 Week she had)", async () => {
          const eveData = await snapshotData(eve);
          assertBNClosePercent(
            eveData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_WEEK),
            "0.4"
          );

          const davidData = await snapshotData(david);
          assertBNClosePercent(
            davidData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_YEAR),
            "0.4"
          );

          await votingLockup.connect(eve).delegate(david.address);

          const davidDataAfter = await snapshotData(david);
          assertBNClosePercent(
            davidDataAfter.userLastPoint.bias,
            calcBias(stakeAmt1.mul(2), ONE_YEAR),
            "0.4"
          );

          const eveDataAfter = await snapshotData(eve);

          // Lock END hasn't changed for eve nor for David
          expect(eveDataAfter.userLocked.end).equal(eveData.userLocked.end);

          expect(davidData.userLocked.end).to.equal(davidData.userLocked.end);

          // Eve's power is ZERO as expected
          expect(
            await votingLockup.balanceOfAt(eve.address, await latestBlockBN())
          ).to.equal(0);
        });

        it("Eve attemps after 2 weeks fails(lock expired) but she now has david's 1 year lock (delegated)", async () => {
          // Eve has still her lock end but cannot withdraw because she has now delegated to David (1 year lock)
          // To withdraw she has to undelegate first
          await expect(votingLockup.connect(eve).withdraw()).to.be.revertedWith(
            "Lock not expired"
          );
          await goToNextUnixWeekStart();
          await goToNextUnixWeekStart();
          await expect(votingLockup.connect(eve).withdraw()).to.be.revertedWith(
            "Lock delegated"
          );
        });

        it("David delegates his voting power to Alice,after she updates her lock time,David still keep Eve's voting power", async () => {
          const aliceData = await snapshotData(alice);
          assertBNClosePercent(
            aliceData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_YEAR),
            "0.4"
          );

          const davidData = await snapshotData(david);
          assertBNClosePercent(
            davidData.userLastPoint.bias,
            calcBias(stakeAmt1.mul(2), ONE_YEAR),
            "0.4"
          );

          // Alice updates her lock longer
          await votingLockup
            .connect(alice)
            .increaseUnlockTime((await getTimestamp()).add(ONE_YEAR));

          // David can now delegate to Alice
          await votingLockup.connect(david).delegate(alice.address);

          const aliceDataAfter = await snapshotData(alice);
          assertBNClosePercent(
            aliceDataAfter.userLastPoint.bias,
            calcBias(stakeAmt1.mul(2), ONE_YEAR),
            "0.4"
          );

          // David still has only Eve's delegated power
          expect(
            await votingLockup.balanceOfAt(david.address, await latestBlockBN())
          ).to.above(0);
        });

        it("Eve decides to move her delegation from David to Alice, but fails because her lock end expired", async () => {
          await goToNextUnixWeekStart();

          // David updates lock time
          await votingLockup
            .connect(david)
            .increaseUnlockTime((await getTimestamp()).add(ONE_YEAR));

          // Alice has her and David's vp
          const aliceData = await snapshotData(alice);
          assertBNClosePercent(
            aliceData.userLastPoint.bias,
            calcBias(stakeAmt1.mul(2), ONE_YEAR),
            "0.4"
          );
          // Eve's lock expired
          await expect(
            votingLockup.connect(eve).delegate(alice.address)
          ).to.be.revertedWith("Lock expired");
        });

        it("Eve decides to delegate to Alice, David has no more voting power, Alice has both", async () => {
          await goToNextUnixWeekStart();
          await goToNextUnixWeekStart();

          const aliceData = await snapshotData(alice);
          assertBNClosePercent(
            aliceData.userLastPoint.bias,
            calcBias(stakeAmt1.mul(2), ONE_YEAR),
            "0.4"
          );

          // Alice's updates her lock time
          await votingLockup
            .connect(alice)
            .increaseUnlockTime((await getTimestamp()).add(ONE_YEAR));

          // Eve lock expired, she will inherit David's one when undelegating
          await votingLockup.connect(eve).delegate(eve.address);

          // Eve can now move her delegation
          await votingLockup.connect(eve).delegate(alice.address);

          const aliceDataAfter = await snapshotData(alice);
          assertBNClosePercent(
            aliceDataAfter.userLastPoint.bias,
            calcBias(stakeAmt1.mul(3), ONE_YEAR),
            "0.4"
          );

          // David has no voting power anymore
          expect(
            await votingLockup.balanceOfAt(david.address, await latestBlockBN())
          ).to.equal(0);
        });
      });

      describe("Delegation and withdrawals", () => {
        it("David's (delegator) and Alice's (delegatee) lock have ended", async () => {
          await increaseTimeTo((await getTimestamp()).add(ONE_YEAR));

          const aliceLockEnd = (await snapshotData(alice)).userLocked.end;

          expect(await getTimestamp()).gt(aliceLockEnd);

          const davidLockEnd = (await snapshotData(david)).userLocked.end;

          expect(await getTimestamp()).gt(davidLockEnd);
        });

        it("David fails to increases lock beyond timestamp and fails to withdraw", async () => {
          await expect(
            votingLockup
              .connect(david)
              .increaseUnlockTime((await getTimestamp()).add(ONE_WEEK))
          ).to.be.revertedWith("Lock expired");

          // David tries to withdraw
          await expect(
            votingLockup.connect(david).withdraw()
          ).to.be.revertedWith("Lock delegated");
        });

        it("David's lock expires, then succeeds to withdraw", async () => {
          await goToNextUnixWeekStart();
          await goToNextUnixWeekStart();

          // David withdraws
          const davidBalBefore = await govMock.balanceOf(david.address);
          await votingLockup.connect(david).delegate(david.address);
          await votingLockup.connect(david).withdraw();

          // David got back his tokens
          expect(await govMock.balanceOf(david.address)).to.equal(
            stakeAmt1.add(davidBalBefore)
          );

          // Alice's cannot update her lock time because it expired
          await expect(
            votingLockup
              .connect(alice)
              .increaseUnlockTime((await getTimestamp()).add(ONE_WEEK.mul(10)))
          ).to.be.revertedWith("Lock expired");

          // Eve cannot withdraw, has to undelegate first
          await expect(votingLockup.connect(eve).withdraw()).to.be.revertedWith(
            "Lock delegated"
          );

          // Alice has no more voting power even if she has some delegated balance from Eve
          // David has no voting power anymore
          expect(
            await votingLockup.balanceOfAt(alice.address, await latestBlockBN())
          ).to.equal(0);
        });
        it("Alice withdraws and re-opens lock, with Eve's delegation still in place, David also re-opens lock ", async () => {
          // Alice's lock expired
          expect(await votingLockup.balanceOf(alice.address)).to.equal(0);
          await votingLockup.connect(alice).withdraw();

          expect(await votingLockup.balanceOf(alice.address)).to.equal(0);

          await votingLockup
            .connect(alice)
            .createLock(
              stakeAmt1,
              (await getTimestamp()).add(ONE_WEEK.mul(26))
            );

          await votingLockup
            .connect(david)
            .createLock(
              stakeAmt1,
              (await getTimestamp()).add(ONE_WEEK.mul(25))
            );

          // Set tolerance to 0.6%

          // Alice has still Eve's voting power
          const aliceData = await snapshotData(alice);
          assertBNClosePercent(
            aliceData.userLastPoint.bias,
            calcBias(stakeAmt1.mul(2), ONE_WEEK.mul(26)),
            "0.6"
          );

          const davidData = await snapshotData(david);
          assertBNClosePercent(
            davidData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_WEEK.mul(25)),
            "0.6"
          );
        });

        it("Eve doesn't have to increase her unlock time to undelegate, David delegates to Alice", async () => {
          // Now that Alice has re-opened the lock, Eve has to wait again (she also need to undelegate first)

          await votingLockup.connect(eve).delegate(eve.address);

          // Alice has only her voting power left
          const aliceData = await snapshotData(alice);
          assertBNClosePercent(
            aliceData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_WEEK.mul(26)),
            "0.6"
          );

          // Eve has her voting power back with the same lock time as Alice's
          const eveData = await snapshotData(eve);
          assertBNClosePercent(
            eveData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_WEEK.mul(26)),
            "0.6"
          );

          // David delegates to alice
          await votingLockup.connect(david).delegate(alice.address);
        });

        it("Eve's withdraw after her lock expiration", async () => {
          await increaseTimeTo((await getTimestamp()).add(ONE_YEAR));

          const eveBalBefore = await govMock.balanceOf(eve.address);

          await votingLockup.connect(eve).withdraw();

          // Eve got back his tokens
          expect(await govMock.balanceOf(eve.address)).to.equal(
            stakeAmt1.add(eveBalBefore)
          );
        });

        it("David has delegated to an expired lock, he can undelegate and withdraw", async () => {
          // Alice lock has expired, David cannot increase his unlock time but can undelegate and withdraw
          await expect(
            votingLockup
              .connect(david)
              .increaseUnlockTime((await getTimestamp()).add(ONE_WEEK))
          ).to.be.revertedWith("Lock expired");

          await increaseTime(ONE_WEEK);

          const davidBalBefore = await govMock.balanceOf(david.address);

          await expect(
            votingLockup.connect(david).withdraw()
          ).to.be.revertedWith("Lock delegated");

          await votingLockup.connect(david).delegate(david.address);
          await votingLockup.connect(david).withdraw();

          // david got back his tokens
          expect(await govMock.balanceOf(david.address)).to.equal(
            stakeAmt1.add(davidBalBefore)
          );
        });

        it("Alice's also withdraws, check totalSupply", async () => {
          // ALL LOCKS HAVE EXPIRED AT THIS POINT, TOTAL SUPPLY (TOTAL VOTING POWER)
          expect(await votingLockup.totalSupply()).to.equal(0);

          const aliceBalBefore = await govMock.balanceOf(alice.address);

          await votingLockup.connect(alice).withdraw();

          // alice got back his tokens
          expect(await govMock.balanceOf(alice.address)).to.equal(
            stakeAmt1.add(aliceBalBefore)
          );

          // Other users also withdraws, all their lock expired
          await expect(
            votingLockup
              .connect(charlie)
              .increaseUnlockTime((await getTimestamp()).add(ONE_WEEK))
          ).to.be.revertedWith("Lock expired");

          await votingLockup.connect(charlie).delegate(charlie.address);
          await votingLockup.connect(charlie).withdraw();

          await votingLockup.connect(bob).withdraw();

          await expect(
            votingLockup.connect(alice).withdraw()
          ).to.be.revertedWith("No lock");
          await expect(votingLockup.connect(bob).withdraw()).to.be.revertedWith(
            "No lock"
          );
          await expect(
            votingLockup.connect(charlie).withdraw()
          ).to.be.revertedWith("No lock");
          await expect(
            votingLockup.connect(david).withdraw()
          ).to.be.revertedWith("No lock");
          await expect(votingLockup.connect(eve).withdraw()).to.be.revertedWith(
            "No lock"
          );

          expect(await votingLockup.totalSupply()).to.equal(0);
        });
      });

      describe("Delegation and quitLocks", () => {
        it("Alice, Bob and Charlie create initial locks", async () => {
          start = await getTimestamp();
          let checkReset;
          checkReset = await snapshotData(alice);
          expect(checkReset.userLastPoint.bias).to.equal(0);
          expect(checkReset.userLastPoint.slope).to.equal(0);
          checkReset = await snapshotData(bob);
          expect(checkReset.userLastPoint.bias).to.equal(0);
          expect(checkReset.userLastPoint.slope).to.equal(0);
          checkReset = await snapshotData(charlie);
          expect(checkReset.userLastPoint.bias).to.equal(0);
          expect(checkReset.userLastPoint.slope).to.equal(0);

          await votingLockup
            .connect(alice)
            .createLock(stakeAmt1, start.add(ONE_YEAR));
          await votingLockup
            .connect(bob)
            .createLock(stakeAmt2, start.add(ONE_WEEK.mul(26)));
          await votingLockup
            .connect(charlie)
            .createLock(stakeAmt1, start.add(ONE_WEEK.mul(26)));
          await votingLockup
            .connect(eve)
            .createLock(stakeAmt1, start.add(ONE_WEEK.mul(26)));

          const aliceData = await snapshotData(alice);
          const bobData = await snapshotData(bob);
          const charlieData = await snapshotData(charlie);

          // Bias
          // Set more tollerance, depends on time, shorter duration, more tollerance required (TODO: review this)
          assertBNClosePercent(
            aliceData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_YEAR),
            "0.9"
          );
          assertBNClosePercent(
            bobData.userLastPoint.bias,
            calcBias(stakeAmt2, ONE_WEEK.mul(26)),
            "1.2"
          );
          assertBNClosePercent(
            charlieData.userLastPoint.bias,
            calcBias(stakeAmt1, ONE_WEEK.mul(26)),
            "1.2"
          );
        });
        let charliePowerBefore: any; // voting power for Charlie with 6 month stake
        it("Charlie delegate to Alice", async () => {
          // Alice has no voting power
          const alicePowerBefore = await votingLockup.balanceOf(alice.address);
          // charlie still has voting power
          charliePowerBefore = await votingLockup.balanceOf(charlie.address);
          // charlie delegates
          await votingLockup.connect(charlie).delegate(alice.address);

          // Alice's has Charlie's voting power
          expect(await votingLockup.balanceOf(charlie.address)).to.equal(0);

          // Charlies now has inherited Alice's lock (from 6 month to 1 year)
          assertBNClosePercent(
            charliePowerBefore.mul(2).add(alicePowerBefore),
            await votingLockup.balanceOf(alice.address),
            "0.4"
          );
        });

        it("Alice quitlocks, Charlie's delegation is also no more accounting for voting power", async () => {
          const aliceBalBefore = await govMock.balanceOf(alice.address);

          expect(await votingLockup.balanceOf(alice.address)).to.above(0);
          expect(await votingLockup.lockEnd(alice.address)).gt(
            await getTimestamp()
          );

          await votingLockup.connect(eve).delegate(alice.address);
          await votingLockup.connect(alice).quitLock();

          // alice got back his tokens after penalty
          expect(await govMock.balanceOf(alice.address)).gt(aliceBalBefore);

          // Alice exited the ve contracts so her personal power is zero, yet still has a locked end > block.timestamp
          // also Charlie's delegation voting power is gone
          expect(await votingLockup.balanceOf(alice.address)).to.equal(0);

          // Charlie has not undelegate so he has no voting power
          expect(await votingLockup.balanceOf(charlie.address)).to.equal(0);
        });

        it("Alice fails to re-open lock", async () => {
          // Alice needs to re-create lock with a longer unlock time than quitted lock
          await expect(
            votingLockup
              .connect(alice)
              .createLock(
                stakeAmt1,
                (await getTimestamp()).add(ONE_WEEK.mul(26))
              )
          ).to.be.revertedWith("Only increase lock end");
        });
        it("Bob fails to delegate to Alice's, after she quitlocked (and still has valid lock end)", async () => {
          const bobPowerBefore = await votingLockup.balanceOf(bob.address);

          // Bob cannot delegate to unexisting lock
          await expect(
            votingLockup.connect(bob).delegate(alice.address)
          ).to.be.revertedWith("Delegatee has no lock");

          assertBNClosePercent(
            bobPowerBefore,
            await votingLockup.balanceOf(bob.address),
            "0.4"
          );
        });

        it("Charlie fails to increase amount while having delegation to unexisting lock", async () => {
          const alicePowerBefore = await votingLockup.balanceOf(alice.address);
          // Charlie cannot increase amount
          await expect(
            votingLockup.connect(charlie).increaseAmount(stakeAmt1)
          ).to.be.revertedWith("Delegatee has no lock");

          assertBNClosePercent(
            alicePowerBefore,
            await votingLockup.balanceOf(alice.address),
            "0.4"
          );
        });

        it("Charlie doesn't have to increase unlock time while having delegation to unexisting lock amount but NOT expired lock end, he undelegates", async () => {
          expect(await votingLockup.balanceOf(charlie.address)).to.equal(0);

          await votingLockup.connect(charlie).delegate(charlie.address);

          // Charlie has his power back
          assertBNClosePercent(
            calcBias(stakeAmt1, ONE_YEAR),
            await votingLockup.balanceOf(charlie.address),
            "0.9"
          );
          // Charlie has his voting power back
          expect(await votingLockup.balanceOf(charlie.address)).to.above(0);
          // Alice has no more voting power
          expect(await votingLockup.balanceOf(alice.address)).to.equal(0);
        });

        it("After their lock end, Alice can now re-create a lock, Bob and Charlie withdraw and re-create too", async () => {
          await increaseTime(ONE_YEAR);
          // Bob and Charlie locked expired
          expect(await votingLockup.lockEnd(charlie.address)).lt(
            await getTimestamp()
          );
          expect(await votingLockup.lockEnd(bob.address)).lt(
            await getTimestamp()
          );
          await votingLockup.connect(charlie).withdraw();
          await votingLockup.connect(bob).withdraw();

          expect(await votingLockup.totalSupply()).to.equal(0);

          //  No-one has voting power
          expect(await votingLockup.balanceOf(alice.address)).to.equal(0);
          expect(await votingLockup.balanceOf(bob.address)).to.equal(0);
          expect(await votingLockup.balanceOf(charlie.address)).to.equal(0);
          expect(await votingLockup.totalSupply()).to.equal(0);
          await votingLockup
            .connect(alice)
            .createLock(stakeAmt1, (await getTimestamp()).add(ONE_YEAR));
          await votingLockup
            .connect(bob)
            .createLock(
              stakeAmt1,
              (await getTimestamp()).add(ONE_WEEK.mul(26))
            );
          await votingLockup
            .connect(charlie)
            .createLock(
              stakeAmt1,
              (await getTimestamp()).add(ONE_WEEK.mul(26))
            );
        });
        it("Bob and Charlie delegate to Alice, then their lock ends, cannot quitLock", async () => {
          const totalSupplyBeforeDelegation = await votingLockup.totalSupply();

          // Bob and Charlie delegate (thier voting power goes to Alice, their lock goes from 6 month to 1 year)
          const bobVP = await votingLockup.balanceOf(bob.address);
          const charlieVP = await votingLockup.balanceOf(charlie.address);
          const aliceVP = await votingLockup.balanceOf(alice.address);

          await votingLockup.connect(bob).delegate(alice.address);
          await votingLockup.connect(charlie).delegate(alice.address);

          expect(await votingLockup.totalSupply()).to.be.above(
            totalSupplyBeforeDelegation
          );

          // Bob and Charlie delegated to Alice, their voting power doubled because they passed from 6 month lock to 1 year
          assertBNClosePercent(
            bobVP.add(charlieVP).mul(2).add(aliceVP),
            await votingLockup.balanceOf(alice.address),
            "0.6"
          );

          await increaseTime(ONE_YEAR.add(ONE_WEEK));

          expect(await votingLockup.lockEnd(alice.address)).lt(
            await getTimestamp()
          );

          await expect(
            votingLockup.connect(alice).quitLock()
          ).to.be.revertedWith("Lock expired");
        });
        it("They all have to withdraw, Bob and Charlie undelegate first", async () => {
          // Lock has expired totalSupply is ZERO
          expect(await votingLockup.totalSupply()).to.equal(0);

          // Bob withdraws before Alice(delegatee)

          await votingLockup.connect(bob).delegate(bob.address);

          await votingLockup.connect(bob).withdraw();

          await votingLockup.connect(alice).withdraw();

          // Charlie withdraws after Alice(delegatee)

          await votingLockup.connect(charlie).delegate(charlie.address);

          await votingLockup.connect(charlie).withdraw();
        });
      });
    });
  });
});
