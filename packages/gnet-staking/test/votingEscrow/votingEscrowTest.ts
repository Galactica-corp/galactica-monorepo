import "module-alias/register";

import { expect } from "chai";
import { ethers, waffle, network } from "hardhat";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import {
  MockERC20,
  MockSmartWallet,
  VotingEscrow,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { advanceBlocks } from "./helpers/time";
import { BigNumber } from "@ethersproject/contracts/node_modules/@ethersproject/bignumber";
import { Signer, utils } from "ethers";
import { increaseTime, increaseTimeTo } from "./helpers/time2";
import { assertBNClosePercent } from "./helpers/assertions";
import { ONE_WEEK } from "./helpers/constants";

const { provider } = waffle;

describe("VotingEscrow Tests", function () {
  let ve: VotingEscrow;
  let govMock: MockERC20;
  let contract: MockSmartWallet;
  let contract2: MockSmartWallet; // ADD TEST FOR 0 BALANCES
  let contract3: MockSmartWallet;
  let admin: SignerWithAddress;
  let treasury: SignerWithAddress;
  const maxPenalty = utils.parseEther("1");
  const name = "veToken";
  const symbol = "veToken";
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let david: SignerWithAddress;
  let eve: SignerWithAddress;
  let francis: SignerWithAddress;
  const initialGovUserBal = utils.parseEther("1000");
  const lockAmount = utils.parseEther("100");
  let tx;
  const MAX = ethers.constants.MaxUint256;
  const ZERO_ADDRESS = ethers.constants.AddressZero;
  const WEEK = 7 * 86400;
  const MAXTIME = 2 * 365 * 86400; // 2 years
  const PRECISION = ethers.constants.WeiPerEther;

  let signers: SignerWithAddress[];

  async function getBlock() {
    return (await ethers.provider.getBlock("latest")).number;
  }
  async function getTimestamp() {
    return (await ethers.provider.getBlock("latest")).timestamp;
  }

  before(async function () {
    await createSnapshot(provider);

    signers = await ethers.getSigners();
    [admin, alice, bob, charlie, david, eve, francis, treasury] = signers;

    // Deploy Governance Token contract
    const govMockDeployer = await ethers.getContractFactory("MockERC20", admin);
    govMock = await govMockDeployer.deploy("FiatDAO", "Token", admin.address);

    // mint gov tokens
    await govMock.mint(alice.address, initialGovUserBal);
    await govMock.mint(bob.address, initialGovUserBal);
    await govMock.mint(charlie.address, initialGovUserBal);
    await govMock.mint(david.address, initialGovUserBal);
    await govMock.mint(eve.address, initialGovUserBal);
    await govMock.mint(francis.address, initialGovUserBal);

    // Deploy VE contract
    const veDeployer = await ethers.getContractFactory("VotingEscrow", admin);
    ve = await veDeployer.deploy(
      admin.address,
      treasury.address,
      govMock.address,
      "veToken",
      "veToken"
    );

    // approve VE contract on gov token
    await govMock.setAllowance(alice.address, ve.address, MAX);
    await govMock.setAllowance(bob.address, ve.address, MAX);
    await govMock.setAllowance(charlie.address, ve.address, MAX);
    await govMock.setAllowance(david.address, ve.address, MAX);
    await govMock.setAllowance(eve.address, ve.address, MAX);
    await govMock.setAllowance(francis.address, ve.address, MAX);

    // Deploy malicious contracts
    const contractDeployer = await ethers.getContractFactory(
      "MockSmartWallet",
      admin
    );
    contract = await contractDeployer.deploy(govMock.address);
    await govMock.mint(contract.address, initialGovUserBal);

    contract2 = await contractDeployer.deploy(govMock.address);
    await govMock.mint(contract2.address, initialGovUserBal);

    contract3 = await contractDeployer.deploy(govMock.address);
    await govMock.mint(contract3.address, initialGovUserBal);
  });
  after(async () => {
    await restoreSnapshot(provider);
  });

  describe("Deployment", async () => {
    it("Initialized properly", async () => {
      expect(await ve.owner()).to.equal(admin.address);

      expect(await ve.name()).to.equal(name);

      expect(await ve.symbol()).to.equal(symbol);

      expect(await ve.penaltyRecipient()).to.equal(treasury.address);

      expect(await ve.penaltyAccumulated()).to.equal(0);

      expect(await ve.totalSupply()).to.equal(0);

      expect(await ve.maxPenalty()).to.equal(maxPenalty);

      expect(await govMock.balanceOf(alice.address)).to.equal(
        initialGovUserBal
      );

      expect(await govMock.balanceOf(bob.address)).to.equal(initialGovUserBal);
    });
  });

  describe("EOA flow", async () => {
    it("Alice and Bob lock tokens in ve", async () => {
      await createSnapshot(provider);
      const lockTime = 4 * WEEK + (await getTimestamp());

      await ve.connect(alice).createLock(lockAmount, lockTime);

      await ve.connect(bob).createLock(lockAmount, lockTime);
    });

    it("Alice and Bob attempt to withdraw before lock end, fail", async () => {
      tx = ve.connect(alice).withdraw();
      await expect(tx).to.be.revertedWith("Lock not expired");

      tx = ve.connect(bob).withdraw();
      await expect(tx).to.be.revertedWith("Lock not expired");
    });

    it("Alice attempts to quit lock, succeeds with penalty", async () => {
      // Increase time to 2 weeks to lock end
      const lockEnd = await ve.lockEnd(alice.address);
      await increaseTimeTo(lockEnd.sub(WEEK * 2));

      // Check penalty to be paid
      const penaltyRate = await ve.getPenaltyRate(lockEnd);
      const expectedPenalty = penaltyRate.mul(lockAmount).div(PRECISION);

      // Quit lock
      await ve.connect(alice).quitLock();

      // Validate penalty is ~ 3.84% (2/52*100)
      assertBNClosePercent(
        expectedPenalty,
        lockAmount.mul(WEEK * 2).div(MAXTIME),
        "0.01"
      );

      // Validate remaining balance
      assertBNClosePercent(
        expectedPenalty,
        initialGovUserBal.sub(await govMock.balanceOf(alice.address)),
        "0.01"
      );
    });

    it("Check accumulated penalty and collect", async () => {
      const lockAmount = utils.parseEther("100");
      expect(await ve.penaltyAccumulated()).gt(0);

      const penaltyAccumulated = await ve.penaltyAccumulated();

      await ve.collectPenalty();

      expect(await ve.penaltyAccumulated()).to.equal(0);

      expect(await govMock.balanceOf(treasury.address)).to.equal(
        penaltyAccumulated
      );
    });

    it("Bob increase his unlock time", async () => {
      const lockTime = 10 * WEEK + (await getTimestamp());
      await ve.connect(bob).increaseUnlockTime(lockTime);
    });

    it("Alice locks again after locked expired, succeed", async () => {
      await increaseTime(5 * WEEK);
      const lockTime = 4 * WEEK + (await getTimestamp());
      await ve.connect(alice).createLock(lockAmount, lockTime);
    });

    it("Admin unlocks ve contracts", async () => {
      tx = ve.connect(alice).withdraw();
      await expect(tx).to.be.revertedWith("Lock not expired");

      await ve.unlock();

      expect(await ve.maxPenalty()).to.equal(0);
    });

    it("Alice and Bob attempt to quit lock, succeeds without penalty", async () => {
      await ve.connect(alice).quitLock();
      assertBNClosePercent(
        await govMock.balanceOf(alice.address),
        initialGovUserBal.sub(lockAmount.mul(2).div(MAXTIME)),
        "0.4"
      );

      await ve.connect(bob).quitLock();
      expect(await govMock.balanceOf(bob.address)).to.equal(initialGovUserBal); // because bob did not quit lock previously but deposited twice

      expect(await ve.penaltyAccumulated()).to.equal(0);

      await restoreSnapshot(provider);
    });
  });

  describe("Malicious contracts flow", async () => {
    it("2 contracts lock tokens in ve", async () => {
      await createSnapshot(provider);

      const lockTime = 4 * WEEK + (await getTimestamp());

      // contract 1
      await contract.createLock(ve.address, lockAmount, lockTime);
      expect(await ve.balanceOf(contract.address)).not.eq(0);
      expect(await ve.balanceOfAt(contract.address, await getBlock())).not.eq(
        0
      );

      // contract 2
      await contract2.createLock(ve.address, lockAmount, lockTime);
      expect(await ve.balanceOf(contract2.address)).not.eq(0);
      expect(await ve.balanceOfAt(contract2.address, await getBlock())).not.eq(
        0
      );
    });

    it("Admin unlocks ve contracts", async () => {
      await ve.unlock();

      expect(await ve.maxPenalty()).to.equal(0);
    });

    it("Allowed contract can quit lock without penalty", async () => {
      await contract2.quitLock(ve.address);
      expect(await govMock.balanceOf(contract2.address)).to.equal(
        initialGovUserBal
      );

      await restoreSnapshot(provider);
    });
  });

  describe("Blocked contracts undelegation", async () => {
    it("2contracts lock tokens in ve", async () => {
      await createSnapshot(provider);

      const lockTime = 4 * WEEK + (await getTimestamp());
      const lockTime2 = 2 * WEEK + (await getTimestamp());
      // contract 1
      await contract.createLock(ve.address, lockAmount, lockTime);
      expect(await ve.balanceOf(contract.address)).not.eq(0);
      expect(await ve.balanceOfAt(contract.address, await getBlock())).not.eq(
        0
      );

      // contract 2
      await contract2.createLock(ve.address, lockAmount, lockTime);
      expect(await ve.balanceOf(contract2.address)).not.eq(0);
      expect(await ve.balanceOfAt(contract2.address, await getBlock())).not.eq(
        0
      );
      // contract 3
      await contract3.createLock(ve.address, lockAmount, lockTime);
      expect(await ve.balanceOf(contract3.address)).not.eq(0);
      expect(await ve.balanceOfAt(contract3.address, await getBlock())).not.eq(
        0
      );
    });
  });

  describe("Delegation flow", async () => {
    it("Alice creates a lock", async () => {
      await createSnapshot(provider);

      const lockTime = 4 * WEEK + (await getTimestamp());

      await ve.connect(alice).createLock(lockAmount, lockTime);

      const block = await getBlock();
      expect(await ve.balanceOfAt(alice.address, block)).to.above(0);
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
    });

    it("Bob creates a lock, Alice delegates to Bob", async () => {
      const lockTime = 5 * WEEK + (await getTimestamp());

      // pre lock balances
      let block = await getBlock();
      expect(await ve.balanceOfAt(alice.address, block)).to.above(0);
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);

      // bob creates lock
      await ve.connect(bob).createLock(lockAmount, lockTime);

      block = await getBlock();
      const preBalance = await ve.balanceOfAt(bob.address, block);
      expect(preBalance).to.above(0);

      // alice delegates
      await ve.connect(alice).delegate(bob.address);

      // post lock balances
      block = await getBlock();
      expect(await ve.balanceOfAt(alice.address, block)).to.equal(0);
      expect(await ve.balanceOfAt(bob.address, block)).to.above(preBalance);
    });

    it("Bob extends his lock beyond Alice's lock, succeeds", async () => {
      const lockTime = 6 * WEEK + (await getTimestamp());

      // pre delegation balances
      let block = await getBlock();
      expect(await ve.balanceOfAt(alice.address, block)).to.equal(0);
      const preBalance = await ve.balanceOfAt(bob.address, block);
      expect(preBalance).to.above(0);

      // Bob extends lock
      await ve.connect(bob).increaseUnlockTime(lockTime);
      block = await getBlock();
      expect(await ve.balanceOfAt(alice.address, block)).to.equal(0);
      expect(await ve.balanceOfAt(bob.address, block)).to.above(preBalance);
    });

    it("Contract creates a lock, Bob delegates to contract", async () => {
      const lockTime = 7 * WEEK + (await getTimestamp());

      // create lock
      await contract.createLock(ve.address, lockAmount, lockTime);
      let block = await getBlock();
      expect(await ve.balanceOfAt(contract.address, block)).to.above(0);

      // delegate to contract
      await ve.connect(bob).delegate(contract.address);
      block = await getBlock();
      expect(await ve.balanceOfAt(alice.address, block)).to.equal(0);
      expect(await ve.balanceOfAt(bob.address, block)).to.above(0);
      expect(await ve.balanceOfAt(contract.address, block)).to.above(0);
    });

    it("Alice re-delegates to contract", async () => {
      let block = await getBlock();
      expect(await ve.balanceOfAt(alice.address, block)).to.equal(0);
      expect(await ve.balanceOfAt(bob.address, block)).to.above(0);

      // re-delegation to contract
      await ve.connect(alice).delegate(contract.address);
      block = await getBlock();
      expect(await ve.balanceOfAt(alice.address, block)).to.equal(0);
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
      expect(await ve.balanceOfAt(contract.address, block)).to.above(0);
    });

    it("Alice extends her lock", async () => {
      const lockTime = 8 * WEEK + (await getTimestamp());
      await ve.connect(alice).increaseUnlockTime(lockTime);

      const block = await getBlock();
      // expect(await ve.lockEnd(alice.address)).to.equal(
      //   Math.trunc(lockTime / WEEK) * WEEK
      // );
    });

    it("Alice's lock ends after Contract's, Alice can delegate back to herself", async () => {
      // pre undelegation
      let block = await getBlock();
      const balance_before_contract = await ve.balanceOfAt(
        contract.address,
        block
      );
      expect(balance_before_contract).to.above(0);

      // undelegate
      await ve.connect(alice).delegate(alice.address);

      // post undelegation
      block = await getBlock();
      expect(await ve.balanceOfAt(alice.address, block)).to.above(0);
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
      expect(await ve.balanceOfAt(contract.address, block)).to.above(0);
    });

    it("Alice's lock is not delegated, Alice can quit", async () => {
      // pre quit
      let block = await getBlock();
      expect(await govMock.balanceOf(alice.address)).to.equal(
        initialGovUserBal.sub(lockAmount)
      );
      expect(await ve.balanceOfAt(alice.address, block)).to.above(0);
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
      expect(await ve.balanceOfAt(contract.address, block)).to.above(0);

      // alice quits
      await ve.connect(alice).quitLock();

      // post quit
      block = await getBlock();

      assertBNClosePercent(
        await govMock.balanceOf(alice.address),
        initialGovUserBal.sub(lockAmount.mul(7 * WEEK).div(MAXTIME)),
        "0.5"
      );
      expect(await ve.balanceOfAt(alice.address, block)).to.equal(0);
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
      expect(await ve.balanceOfAt(contract.address, block)).to.above(0);
    });

    it("Bob's lock is delegated, Bob cannot quit", async () => {
      // pre quit
      let block = await getBlock();
      expect(await govMock.balanceOf(bob.address)).to.equal(
        initialGovUserBal.sub(lockAmount)
      );
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);

      // Bob attempts to quit
      tx = ve.connect(bob).quitLock();
      await expect(tx).to.be.revertedWith("Lock delegated");

      // post quit
      block = await getBlock();
      expect(await govMock.balanceOf(bob.address)).to.equal(
        initialGovUserBal.sub(lockAmount)
      );
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
    });

    it("Bob extends lock and undelegates", async () => {
      // pre undelegation
      let block = await getBlock();
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
      const preBalance = await ve.balanceOfAt(contract.address, block);
      expect(preBalance).to.above(0);

      // Bob extends and undelegates
      await ve
        .connect(bob)
        .increaseUnlockTime(7 * WEEK + (await getTimestamp()));
      await ve.connect(bob).delegate(bob.address);

      // post undelegation
      block = await getBlock();
      expect(await ve.balanceOfAt(bob.address, block)).to.above(0);
      const postBalance = await ve.balanceOfAt(contract.address, block);
      expect(postBalance).to.above(0);
      expect(postBalance).to.below(preBalance);
    });

    it("Bob's lock is not delegated, Bob can quit", async () => {
      // pre quit
      let block = await getBlock();
      expect(await govMock.balanceOf(bob.address)).to.equal(
        initialGovUserBal.sub(lockAmount)
      );
      expect(await ve.balanceOfAt(bob.address, block)).to.above(0);

      // alice quits
      await ve.connect(bob).quitLock();

      // post quit
      block = await getBlock();
      assertBNClosePercent(
        await govMock.balanceOf(bob.address),
        initialGovUserBal.sub(lockAmount.mul(6 * WEEK).div(MAXTIME)),
        "0.5"
      );
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
    });

    it("Contract extends lock beyond Bob's lock, ", async () => {
      const lockTimeContract = 30 * WEEK + (await getTimestamp());
      await contract.increaseUnlockTime(ve.address, lockTimeContract);

      await increaseTime(8 * WEEK);
      // pre delegation
      const block = await getBlock();
      assertBNClosePercent(
        await govMock.balanceOf(bob.address),
        initialGovUserBal.sub(lockAmount.mul(7 * WEEK).div(MAXTIME)),
        "0.5"
      );
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
    });

    it("Bob attempts to lock again, succeeds, Bob can delegate to contract", async () => {
      const lockTime = 10 * WEEK + (await getTimestamp());
      // bob creates a new lock
      await ve.connect(bob).createLock(lockAmount, lockTime);

      let block = await getBlock();
      const preBalance = await ve.balanceOfAt(contract.address, block);
      expect(preBalance).to.above(0);

      await ve.connect(bob).delegate(contract.address);

      // post delegation
      block = await getBlock();
      assertBNClosePercent(
        await govMock.balanceOf(bob.address),
        initialGovUserBal
          .sub(lockAmount.mul(7 * WEEK).div(MAXTIME))
          .sub(lockAmount),
        "0.5"
      );
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
      const postBalance = await ve.balanceOfAt(contract.address, block);
      expect(postBalance).to.above(preBalance);
      // const block = await getBlock();
      // expect(await ve.lockEnd(contract.address)).to.equal(
      //   Math.trunc(lockTime / WEEK) * WEEK
      // );
    });

    it("Contract's lock is not delegated, contract can quit and but lose delegated balance", async () => {
      // pre quit
      let block = await getBlock();
      expect(await govMock.balanceOf(contract.address)).to.equal(
        initialGovUserBal.sub(lockAmount)
      );
      const preBalance = await ve.balanceOfAt(contract.address, block);
      expect(preBalance).to.above(0);

      // contract quits
      await contract.quitLock(ve.address);

      // post quit
      block = await getBlock();

      // Contract locked for 30 weeks, then we advanced 8 weeks
      assertBNClosePercent(
        await govMock.balanceOf(contract.address),
        initialGovUserBal.sub(lockAmount.mul(21 * WEEK).div(MAXTIME)),
        "0.5"
      );
      const postBalance = await ve.balanceOfAt(contract.address, block);
      expect(postBalance).to.equal(0);
      expect(postBalance).to.below(preBalance);
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
    });

    it("Bob's lock ends before Contract's, Bob can still delegate back to himself", async () => {
      // pre undelegation
      let block = await getBlock();
      expect(await ve.balanceOfAt(bob.address, block)).to.equal(0);
      expect(await ve.balanceOfAt(contract.address, block)).to.equal(0);

      // undelegate
      await ve.connect(bob).delegate(bob.address);

      // post undelegation
      block = await getBlock();
      expect(await ve.balanceOfAt(bob.address, block)).to.above(0);
      expect(await ve.balanceOfAt(contract.address, block)).to.equal(0);

      await restoreSnapshot(provider);
    });
  });

  describe("Quitlock flow", async () => {
    it("Alice, Bob, Charlie, David and Eve lock tokens in ve", async () => {
      await createSnapshot(provider);
      // MAXTIME => 2 years
      const lockTime1 = MAXTIME + (await getTimestamp());
      const lockTime2 = MAXTIME / 2 + (await getTimestamp());

      // 2 years lock
      await ve.connect(alice).createLock(lockAmount, lockTime1);
      await ve.connect(bob).createLock(lockAmount, lockTime1);
      await ve.connect(charlie).createLock(lockAmount, lockTime1);
      await ve.connect(francis).createLock(lockAmount, lockTime1);

      // 1 year lock
      await ve.connect(david).createLock(lockAmount, lockTime2);
      await ve.connect(eve).createLock(lockAmount, lockTime2);
    });

    it("Alice and David quitlocks after ~3 months", async () => {
      // Alice would have ~91 weeks left
      const lockEnd = await ve.lockEnd(alice.address);
      await increaseTimeTo(lockEnd.sub(WEEK * 91));

      await ve.connect(alice).quitLock();
      const penaltyRate = await ve.getPenaltyRate(lockEnd);
      const expectedPenalty = penaltyRate.mul(lockAmount).div(PRECISION);
      // Check penalty to be paid
      assertBNClosePercent(
        expectedPenalty,
        lockAmount.mul(WEEK * 91).div(MAXTIME),
        "0.01"
      );

      // Validate remaining balance
      assertBNClosePercent(
        expectedPenalty,
        initialGovUserBal.sub(await govMock.balanceOf(alice.address)),
        "0.01"
      );

      const lockEndDavid = await ve.lockEnd(david.address);
      const penaltyRateDavid = await ve.getPenaltyRate(lockEndDavid);
      const expectedPenaltyDavid = penaltyRateDavid
        .mul(lockAmount)
        .div(PRECISION);

      // David would have ~39 weeks left
      await ve.connect(david).quitLock();
      assertBNClosePercent(
        expectedPenaltyDavid,
        lockAmount.mul(WEEK * 39).div(MAXTIME),
        "0.01"
      );
      // Validate remaining balance
      assertBNClosePercent(
        expectedPenaltyDavid,
        initialGovUserBal.sub(await govMock.balanceOf(david.address)),
        "0.01"
      );
    });

    it("Bob and Eve quitlocks after ~ 4 months", async () => {
      // Bob would have ~87 weeks left
      const lockEndBob = await ve.lockEnd(bob.address);
      await increaseTimeTo(lockEndBob.sub(WEEK * 87));

      const penaltyRateBob = await ve.getPenaltyRate(lockEndBob);
      const expectedPenaltyBob = penaltyRateBob.mul(lockAmount).div(PRECISION);

      await ve.connect(bob).quitLock();

      assertBNClosePercent(
        expectedPenaltyBob,
        lockAmount.mul(WEEK * 87).div(MAXTIME),
        "0.01"
      );

      // Validate remaining balance
      assertBNClosePercent(
        expectedPenaltyBob,
        initialGovUserBal.sub(await govMock.balanceOf(bob.address)),
        "0.01"
      );

      const lockEndEve = await ve.lockEnd(eve.address);
      const penaltyRateEve = await ve.getPenaltyRate(lockEndEve);
      const expectedPenaltyEve = penaltyRateEve.mul(lockAmount).div(PRECISION);
      // Eve would have ~35 weeks left
      await ve.connect(eve).quitLock();

      assertBNClosePercent(
        expectedPenaltyEve,
        lockAmount.mul(WEEK * 35).div(MAXTIME),
        "0.01"
      );
      // Validate remaining balance
      assertBNClosePercent(
        expectedPenaltyEve,
        initialGovUserBal.sub(await govMock.balanceOf(eve.address)),
        "0.01"
      );
    });

    it("Charlie quitlocks after ~ 9 months", async () => {
      // Charlie would have ~66 weeks left
      const lockEndCharlie = await ve.lockEnd(charlie.address);
      await increaseTimeTo(lockEndCharlie.sub(WEEK * 66));

      const penaltyRateCharlie = await ve.getPenaltyRate(lockEndCharlie);
      const expectedPenaltyCharlie = penaltyRateCharlie
        .mul(lockAmount)
        .div(PRECISION);

      await ve.connect(charlie).quitLock();

      assertBNClosePercent(
        expectedPenaltyCharlie,
        lockAmount.mul(WEEK * 66).div(MAXTIME),
        "0.01"
      );

      // Validate remaining balance
      assertBNClosePercent(
        expectedPenaltyCharlie,
        initialGovUserBal.sub(await govMock.balanceOf(charlie.address)),
        "0.01"
      );
    });

    it("Francis quitlocks 1 week before end", async () => {
      // Francis would have ~1 week left
      const lockEndFrancis = await ve.lockEnd(francis.address);
      await increaseTimeTo(lockEndFrancis.sub(WEEK * 1));

      const penaltyRateFrancis = await ve.getPenaltyRate(lockEndFrancis);
      const expectedPenaltyFrancis = penaltyRateFrancis
        .mul(lockAmount)
        .div(PRECISION);

      await ve.connect(francis).quitLock();

      assertBNClosePercent(
        expectedPenaltyFrancis,
        lockAmount.mul(WEEK * 1).div(MAXTIME),
        "0.01"
      );

      // Validate remaining balance
      assertBNClosePercent(
        expectedPenaltyFrancis,
        initialGovUserBal.sub(await govMock.balanceOf(francis.address)),
        "0.01"
      );
    });

    it("Alice locks again, then penalty is taken away,she withdraws without penalty", async () => {
      const aliceBalBefore = await govMock.balanceOf(alice.address);
      await ve
        .connect(alice)
        .createLock(lockAmount, (await getTimestamp()) + MAXTIME);
      await ve.unlock();
      await ve.connect(alice).quitLock();
      expect(await govMock.balanceOf(alice.address)).to.equal(aliceBalBefore);
    });
  });
});
