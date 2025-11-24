import { expect } from 'chai';
import { ethers, ignition } from 'hardhat';
import {
  time,
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import type { MockSmartWallet } from '../../typechain-types/contracts/test/MockSmartWallet';
import type { VotingEscrow } from '../../typechain-types/contracts/VotingEscrow';
import { assertBNClosePercent } from './helpers/assertions';
import votingEscrowModule from '../../ignition/modules/VotingEscrow.m';

describe('VotingEscrow Tests', function () {
  const maxPenalty = ethers.parseEther('1');
  const name = 'veToken';
  const symbol = 'veToken';
  const initialGovUserBal = ethers.parseEther('1000');
  const lockAmount = ethers.parseEther('100');
  const WEEK = 7 * 86400;
  const MAXTIME = 2 * 365 * 86400; // 2 years
  const PRECISION = ethers.parseEther('1');

  async function getBlock() {
    return (await ethers.provider.getBlock('latest'))!.number;
  }
  async function getTimestamp() {
    return (await ethers.provider.getBlock('latest'))!.timestamp;
  }

  async function deployFixture() {
    const [
      admin,
      alice,
      bob,
      charlie,
      david,
      eve,
      francis,
      treasury,
    ] = await ethers.getSigners();

    const wGNET = await ethers.deployContract('WGNET10');

    // Deploy VE contract using Ignition
    // This ensures Ignition can properly simulate the deployment
    const { votingEscrow } = await ignition.deploy(votingEscrowModule, {
      parameters: {
        VotingEscrowModule: {
          owner: admin.address,
          penaltyRecipient: treasury.address,
          name,
          symbol,
          wGNET: await wGNET.getAddress(),
        },
        TimelockControllerModule: {
          minDelay: 0,
        },
      },
    });

    const ve = votingEscrow as unknown as VotingEscrow;

    // Fund accounts with native tokens
    await ethers.provider.send('hardhat_setBalance', [
      alice.address,
      '0x' + (initialGovUserBal).toString(16),
    ]);
    await ethers.provider.send('hardhat_setBalance', [
      bob.address,
      '0x' + (initialGovUserBal).toString(16),
    ]);
    await ethers.provider.send('hardhat_setBalance', [
      charlie.address,
      '0x' + (initialGovUserBal).toString(16),
    ]);
    await ethers.provider.send('hardhat_setBalance', [
      david.address,
      '0x' + (initialGovUserBal).toString(16),
    ]);
    await ethers.provider.send('hardhat_setBalance', [
      eve.address,
      '0x' + (initialGovUserBal).toString(16),
    ]);
    await ethers.provider.send('hardhat_setBalance', [
      francis.address,
      '0x' + (initialGovUserBal).toString(16),
    ]);

    const contractDeployer = await ethers.getContractFactory('MockSmartWallet');
    const contract = (await contractDeployer.deploy()) as unknown as MockSmartWallet;
    await ethers.provider.send('hardhat_setBalance', [
      await contract.getAddress(),
      '0x' + (initialGovUserBal).toString(16),
    ]);

    const contract2 = (await contractDeployer.deploy()) as unknown as MockSmartWallet;
    await ethers.provider.send('hardhat_setBalance', [
      await contract2.getAddress(),
      '0x' + (initialGovUserBal).toString(16),
    ]);

    const contract3 = (await contractDeployer.deploy()) as unknown as MockSmartWallet;
    await ethers.provider.send('hardhat_setBalance', [
      await contract3.getAddress(),
      '0x' + (initialGovUserBal).toString(16),
    ]);

    return {
      ve,
      contract,
      contract2,
      contract3,
      admin,
      alice,
      bob,
      charlie,
      david,
      eve,
      francis,
      treasury,
      wGNET,
    };
  }

  describe('Deployment', async () => {
    it('Initialized properly', async () => {
      const { ve, admin, alice, bob, treasury } =
        await loadFixture(deployFixture);

      expect(await ve.owner()).to.equal(admin.address);

      expect(await ve.name()).to.equal(name);

      expect(await ve.symbol()).to.equal(symbol);

      expect(await ve.penaltyRecipient()).to.equal(treasury.address);

      expect(await ve.penaltyAccumulated()).to.equal(0);

      expect(await ve.totalSupply()).to.equal(0);

      expect(await ve.maxPenalty()).to.equal(maxPenalty);

      expect(await ethers.provider.getBalance(alice.address)).to.be.gte(
        initialGovUserBal,
      );

      expect(await ethers.provider.getBalance(bob.address)).to.be.gte(initialGovUserBal);
    });
  });

  describe('EOA flow', async () => {
    it('Alice and Bob lock tokens in ve', async () => {
      const { ve, alice, bob } = await loadFixture(deployFixture);
      const lockTime = 4 * WEEK + (await getTimestamp());

      await ve.connect(alice).createLock(lockTime, { value: lockAmount });

      await ve.connect(bob).createLock(lockTime, { value: lockAmount });
    });

    it('Alice and Bob attempt to withdraw before lock end, fail', async () => {
      const { ve, alice, bob } = await loadFixture(deployFixture);
      const lockTime = 4 * WEEK + (await getTimestamp());
      await ve.connect(alice).createLock(lockTime, { value: lockAmount });
      await ve.connect(bob).createLock(lockTime, { value: lockAmount });

      const tx = ve.connect(alice).withdraw();
      await expect(tx).to.be.revertedWith('Lock not expired');

      const tx2 = ve.connect(bob).withdraw();
      await expect(tx2).to.be.revertedWith('Lock not expired');
    });

    it('Alice attempts to quit lock, succeeds with penalty', async () => {
      const { ve, alice } = await loadFixture(deployFixture);
      const lockTime = 4 * WEEK + (await getTimestamp());
      let accumulatedFees = 0n;
      let tx = await ve.connect(alice).createLock(lockTime, { value: lockAmount });
      accumulatedFees += (await tx.wait())!.fee;

      // Increase time to 2 weeks to lock end
      const lockEnd = await ve.lockEnd(alice.address);
      await time.increaseTo(lockEnd - BigInt(WEEK * 2));

      // Check penalty to be paid
      const penaltyRate = await ve.getPenaltyRate(lockEnd);
      const expectedPenalty = (penaltyRate * lockAmount) / PRECISION;

      // Quit lock
      tx = await ve.connect(alice).quitLock();
      accumulatedFees += (await tx.wait())!.fee;

      // Validate penalty is ~ 3.84% (2/52*100)
      assertBNClosePercent(
        expectedPenalty,
        (lockAmount * BigInt(WEEK * 2)) / BigInt(MAXTIME),
        '0.01',
      );

      // Validate remaining balance
      assertBNClosePercent(
        expectedPenalty,
        initialGovUserBal - (await ethers.provider.getBalance(alice.address)) - accumulatedFees,
        '0.01',
      );
    });

    it('Check accumulated penalty and collect', async () => {
      const { ve, alice, treasury } = await loadFixture(deployFixture);
      const lockTime = 4 * WEEK + (await getTimestamp());
      await ve.connect(alice).createLock(lockTime, { value: lockAmount });
      const lockEnd = await ve.lockEnd(alice.address);
      await time.increaseTo(lockEnd - BigInt(WEEK * 2));
      await ve.connect(alice).quitLock();

      expect(await ve.penaltyAccumulated()).gt(0);

      const penaltyAccumulated = await ve.penaltyAccumulated();
      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
      await ve.collectPenalty();
      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
        penaltyAccumulated,
      );
    });

    it('Bob increase his unlock time', async () => {
      const { ve, bob } = await loadFixture(deployFixture);
      const lockTime = 4 * WEEK + (await getTimestamp());
      await ve.connect(bob).createLock(lockTime, { value: lockAmount });
      const newLockTime = 10 * WEEK + (await getTimestamp());
      await ve.connect(bob).increaseUnlockTime(newLockTime);
    });

    it('Alice locks again after locked expired and withdraws, succeed', async () => {
      const { ve, alice } = await loadFixture(deployFixture);
      const lockTime = 4 * WEEK + (await getTimestamp());
      await ve.connect(alice).createLock(lockTime, { value: lockAmount });
      await time.increase(5 * WEEK);
      const newLockTime = 4 * WEEK + (await getTimestamp());
      await ve.connect(alice).withdraw();
      await ve.connect(alice).createLock(newLockTime, { value: lockAmount });
    });

    it('Admin unlocks ve contracts', async () => {
      const { ve, alice } = await loadFixture(deployFixture);
      const lockTime = 4 * WEEK + (await getTimestamp());
      await ve.connect(alice).createLock(lockTime, { value: lockAmount });

      const tx = ve.connect(alice).withdraw();
      await expect(tx).to.be.revertedWith('Lock not expired');

      await ve.unlock();

      expect(await ve.maxPenalty()).to.equal(0);
    });

    it('Alice and Bob attempt to quit lock, succeeds without penalty', async () => {
      const { ve, alice, bob } = await loadFixture(deployFixture);
      const lockTime = 4 * WEEK + (await getTimestamp());
      await ve.connect(alice).createLock(lockTime, { value: lockAmount });
      await ve.connect(bob).createLock(lockTime, { value: lockAmount });
      await ve.unlock();

      await ve.connect(alice).quitLock();
      assertBNClosePercent(
        await ethers.provider.getBalance(alice.address),
        initialGovUserBal,
        '0.1',
      );

      await ve.connect(bob).quitLock();
      assertBNClosePercent(
        await ethers.provider.getBalance(alice.address),
        initialGovUserBal,
        '0.1',
      );

      expect(await ve.penaltyAccumulated()).to.equal(0);
    });
  });

  describe('Quitlock flow', async () => {
    it('Alice, Bob, Charlie, David and Eve lock tokens in ve', async () => {
      const { ve, alice, bob, charlie, david, eve, francis } =
        await loadFixture(deployFixture);
      // MAXTIME => 2 years
      const lockTime1 = MAXTIME + (await getTimestamp());
      const lockTime2 = Math.floor(MAXTIME / 2) + (await getTimestamp());

      // 2 years lock
      await ve.connect(alice).createLock(lockTime1, { value: lockAmount });
      await ve.connect(bob).createLock(lockTime1, { value: lockAmount });
      await ve.connect(charlie).createLock(lockTime1, { value: lockAmount });
      await ve.connect(francis).createLock(lockTime1, { value: lockAmount });

      // 1 year lock
      await ve.connect(david).createLock(lockTime2, { value: lockAmount });
      await ve.connect(eve).createLock(lockTime2, { value: lockAmount });
    });

    it('Alice and David quitlocks after ~3 months', async () => {
      const { ve, alice, bob, charlie, david, eve, francis } =
        await loadFixture(deployFixture);
      const lockTime1 = MAXTIME + (await getTimestamp());
      const lockTime2 = Math.floor(MAXTIME / 2) + (await getTimestamp());
      let accumulatedFeesAlice = 0n;
      let accumulatedFeesDavid = 0n;
      let tx = await ve.connect(alice).createLock(lockTime1, { value: lockAmount });
      accumulatedFeesAlice += (await tx.wait())!.fee;
      await ve.connect(bob).createLock(lockTime1, { value: lockAmount });
      await ve.connect(charlie).createLock(lockTime1, { value: lockAmount });
      await ve.connect(francis).createLock(lockTime1, { value: lockAmount });
      tx = await ve.connect(david).createLock(lockTime2, { value: lockAmount });
      accumulatedFeesDavid += (await tx.wait())!.fee;
      await ve.connect(eve).createLock(lockTime2, { value: lockAmount });

      // Alice would have ~91 weeks left
      const lockEnd = await ve.lockEnd(alice.address);
      await time.increaseTo(lockEnd - BigInt(WEEK * 91));

      tx = await ve.connect(alice).quitLock();
      accumulatedFeesAlice += (await tx.wait())!.fee;
      const penaltyRate = await ve.getPenaltyRate(lockEnd);
      const expectedPenalty = (penaltyRate * lockAmount) / PRECISION;
      // Check penalty to be paid
      assertBNClosePercent(
        expectedPenalty,
        (lockAmount * BigInt(WEEK * 91)) / BigInt(MAXTIME),
        '0.01',
      );

      // Validate remaining balance
      assertBNClosePercent(
        expectedPenalty,
        initialGovUserBal - (await ethers.provider.getBalance(alice.address)) - accumulatedFeesAlice,
        '0.01',
      );

      const lockEndDavid = await ve.lockEnd(david.address);
      const penaltyRateDavid = await ve.getPenaltyRate(lockEndDavid);
      const expectedPenaltyDavid = (penaltyRateDavid * lockAmount) / PRECISION;

      // David would have ~39 weeks left
      tx = await ve.connect(david).quitLock();
      accumulatedFeesDavid += (await tx.wait())!.fee;
      assertBNClosePercent(
        expectedPenaltyDavid,
        (lockAmount * BigInt(WEEK * 39)) / BigInt(MAXTIME),
        '0.01',
      );
      // Validate remaining balance
      assertBNClosePercent(
        expectedPenaltyDavid,
        initialGovUserBal - (await ethers.provider.getBalance(david.address)) - accumulatedFeesDavid,
        '0.01',
      );
    });

    it('Bob and Eve quitlocks after ~ 4 months', async () => {
      const { ve, alice, bob, charlie, david, eve, francis } =
        await loadFixture(deployFixture);
      const lockTime1 = MAXTIME + (await getTimestamp());
      const lockTime2 = Math.floor(MAXTIME / 2) + (await getTimestamp());
      await ve.connect(alice).createLock(lockTime1, { value: lockAmount });
      await ve.connect(bob).createLock(lockTime1, { value: lockAmount });
      await ve.connect(charlie).createLock(lockTime1, { value: lockAmount });
      await ve.connect(francis).createLock(lockTime1, { value: lockAmount });
      await ve.connect(david).createLock(lockTime2, { value: lockAmount });
      await ve.connect(eve).createLock(lockTime2, { value: lockAmount });
      const lockEnd = await ve.lockEnd(alice.address);
      await time.increaseTo(lockEnd - BigInt(WEEK * 91));
      await ve.connect(alice).quitLock();

      // Bob would have ~87 weeks left
      const lockEndBob = await ve.lockEnd(bob.address);
      await time.increaseTo(lockEndBob - BigInt(WEEK * 87));

      const penaltyRateBob = await ve.getPenaltyRate(lockEndBob);
      const expectedPenaltyBob = (penaltyRateBob * lockAmount) / PRECISION;

      await ve.connect(bob).quitLock();

      assertBNClosePercent(
        expectedPenaltyBob,
        (lockAmount * BigInt(WEEK * 87)) / BigInt(MAXTIME),
        '0.01',
      );

      // Validate remaining balance
      assertBNClosePercent(
        expectedPenaltyBob,
        initialGovUserBal - (await ethers.provider.getBalance(bob.address)),
        '0.01',
      );

      const lockEndEve = await ve.lockEnd(eve.address);
      const penaltyRateEve = await ve.getPenaltyRate(lockEndEve);
      const expectedPenaltyEve = (penaltyRateEve * lockAmount) / PRECISION;
      // Eve would have ~35 weeks left
      await ve.connect(eve).quitLock();

      assertBNClosePercent(
        expectedPenaltyEve,
        (lockAmount * BigInt(WEEK * 35)) / BigInt(MAXTIME),
        '0.01',
      );
      // Validate remaining balance
      assertBNClosePercent(
        expectedPenaltyEve,
        initialGovUserBal - (await ethers.provider.getBalance(eve.address)),
        '0.01',
      );
    });

    it('Charlie quitlocks after ~ 9 months', async () => {
      const { ve, alice, bob, charlie, david, eve, francis } =
        await loadFixture(deployFixture);
      const lockTime1 = MAXTIME + (await getTimestamp());
      const lockTime2 = Math.floor(MAXTIME / 2) + (await getTimestamp());
      await ve.connect(alice).createLock(lockTime1, { value: lockAmount });
      await ve.connect(bob).createLock(lockTime1, { value: lockAmount });
      await ve.connect(charlie).createLock(lockTime1, { value: lockAmount });
      await ve.connect(francis).createLock(lockTime1, { value: lockAmount });
      await ve.connect(david).createLock(lockTime2, { value: lockAmount });
      await ve.connect(eve).createLock(lockTime2, { value: lockAmount });
      const lockEnd = await ve.lockEnd(alice.address);
      await time.increaseTo(lockEnd - BigInt(WEEK * 91));
      await ve.connect(alice).quitLock();
      await ve.connect(david).quitLock();
      const lockEndBob = await ve.lockEnd(bob.address);
      await time.increaseTo(lockEndBob - BigInt(WEEK * 87));
      await ve.connect(bob).quitLock();
      await ve.connect(eve).quitLock();

      // Charlie would have ~66 weeks left
      const lockEndCharlie = await ve.lockEnd(charlie.address);
      await time.increaseTo(lockEndCharlie - BigInt(WEEK * 66));

      const penaltyRateCharlie = await ve.getPenaltyRate(lockEndCharlie);
      const expectedPenaltyCharlie = (penaltyRateCharlie * lockAmount) / PRECISION;

      await ve.connect(charlie).quitLock();

      assertBNClosePercent(
        expectedPenaltyCharlie,
        (lockAmount * BigInt(WEEK * 66)) / BigInt(MAXTIME),
        '0.01',
      );

      // Validate remaining balance
      assertBNClosePercent(
        expectedPenaltyCharlie,
        initialGovUserBal - (await ethers.provider.getBalance(charlie.address)),
        '0.01',
      );
    });

    it('Francis quitlocks 1 week before end', async () => {
      const { ve, alice, bob, charlie, david, eve, francis } =
        await loadFixture(deployFixture);
      let accumulatedFeesFrancis = 0n;
      const lockTime1 = MAXTIME + (await getTimestamp());
      const lockTime2 = Math.floor(MAXTIME / 2) + (await getTimestamp());
      await ve.connect(alice).createLock(lockTime1, { value: lockAmount });
      await ve.connect(bob).createLock(lockTime1, { value: lockAmount });
      await ve.connect(charlie).createLock(lockTime1, { value: lockAmount });
      let tx = await ve.connect(francis).createLock(lockTime1, { value: lockAmount });
      accumulatedFeesFrancis += (await tx.wait())!.fee;
      await ve.connect(david).createLock(lockTime2, { value: lockAmount });
      await ve.connect(eve).createLock(lockTime2, { value: lockAmount });
      const lockEnd = await ve.lockEnd(alice.address);
      await time.increaseTo(lockEnd - BigInt(WEEK * 91));
      await ve.connect(alice).quitLock();
      await ve.connect(david).quitLock();
      const lockEndBob = await ve.lockEnd(bob.address);
      await time.increaseTo(lockEndBob - BigInt(WEEK * 87));
      await ve.connect(bob).quitLock();
      await ve.connect(eve).quitLock();
      const lockEndCharlie = await ve.lockEnd(charlie.address);
      await time.increaseTo(lockEndCharlie - BigInt(WEEK * 66));
      await ve.connect(charlie).quitLock();

      // Francis would have ~1 week left
      const lockEndFrancis = await ve.lockEnd(francis.address);
      await time.increaseTo(lockEndFrancis - BigInt(WEEK * 1));

      const penaltyRateFrancis = await ve.getPenaltyRate(lockEndFrancis);
      const expectedPenaltyFrancis = (penaltyRateFrancis * lockAmount) / PRECISION;

      tx = await ve.connect(francis).quitLock();
      accumulatedFeesFrancis += (await tx.wait())!.fee;
      assertBNClosePercent(
        expectedPenaltyFrancis,
        (lockAmount * BigInt(WEEK * 1)) / BigInt(MAXTIME),
        '0.01',
      );

      // Validate remaining balance
      assertBNClosePercent(
        expectedPenaltyFrancis,
        initialGovUserBal - (await ethers.provider.getBalance(francis.address)) - accumulatedFeesFrancis,
        '0.01',
      );
    });

    it('Alice locks again, then penalty is taken away,she withdraws without penalty', async () => {
      const { ve, alice } = await loadFixture(deployFixture);
      const lockTime1 = MAXTIME + (await getTimestamp());
      let tx = await ve.connect(alice).createLock(lockTime1, { value: lockAmount });
      const lockEnd = await ve.lockEnd(alice.address);
      await time.increaseTo(lockEnd - BigInt(WEEK * 91));
      tx = await ve.connect(alice).quitLock();
      const aliceBalBefore = await ethers.provider.getBalance(alice.address);
      let accumulatedFeesAlice = 0n;
      tx = await ve
        .connect(alice)
        .createLock(BigInt(await getTimestamp()) + BigInt(MAXTIME), { value: lockAmount });
      accumulatedFeesAlice += (await tx.wait())!.fee;
      await ve.unlock();
      tx = await ve.connect(alice).quitLock();
      accumulatedFeesAlice += (await tx.wait())!.fee;
      expect(await ethers.provider.getBalance(alice.address)).to.equal(aliceBalBefore - accumulatedFeesAlice);
    });
  });

  describe('Wrapped token flow', async () => {
    it('Alice locks with wrapped token', async () => {
      const { ve, alice, wGNET } = await loadFixture(deployFixture);
      const lockTime = MAXTIME + (await getTimestamp());

      await wGNET.connect(alice).deposit({ value: lockAmount });
      await wGNET.connect(alice).approve(await ve.getAddress(), lockAmount);

      await ve.connect(alice).createLockWithWrappedToken(lockTime, lockAmount);

      expect(await wGNET.balanceOf(alice.address)).to.equal(0);
      assertBNClosePercent(
        await ve.balanceOf(alice.address),
        lockAmount * (await ve.lockEnd(alice.address) - BigInt(await getTimestamp())) / BigInt(MAXTIME),
        '0.01',
      );
    });
    it('Alice locks with wrapped token and increases lock', async () => {
      const { ve, alice, wGNET } = await loadFixture(deployFixture);
      const lockTime = MAXTIME + (await getTimestamp());

      await wGNET.connect(alice).deposit({ value: lockAmount * 3n });
      await wGNET.connect(alice).approve(await ve.getAddress(), lockAmount * 3n);

      await ve.connect(alice).createLockWithWrappedToken(lockTime, lockAmount);
      await ve.connect(alice).increaseAmountWithWrappedToken(lockAmount * 2n);

      expect(await wGNET.balanceOf(alice.address)).to.equal(0);
      assertBNClosePercent(
        await ve.balanceOf(alice.address),
        lockAmount * 3n * (await ve.lockEnd(alice.address) - BigInt(await getTimestamp())) / BigInt(MAXTIME),
        '0.01',
      );
    });
    it('Alice locks and withdraws wrapped tokens after expiration', async () => {
      const { ve, alice, wGNET } = await loadFixture(deployFixture);
      const lockTime = MAXTIME + (await getTimestamp());

      await wGNET.connect(alice).deposit({ value: lockAmount });
      await wGNET.connect(alice).approve(await ve.getAddress(), lockAmount);
      await ve.connect(alice).createLockWithWrappedToken(lockTime, lockAmount);

      await time.increaseTo(lockTime);

      await ve.connect(alice).withdrawWrappedToken();

      expect(await wGNET.balanceOf(alice.address)).to.equal(lockAmount);
      expect(await ve.balanceOf(alice.address)).to.equal(0);
    });
    it('Alice locks and quits with wrapped token', async () => {
      const { ve, alice, wGNET } = await loadFixture(deployFixture);
      const lockTime = MAXTIME + (await getTimestamp());

      await wGNET.connect(alice).deposit({ value: lockAmount });
      await wGNET.connect(alice).approve(await ve.getAddress(), lockAmount);
      await ve.connect(alice).createLockWithWrappedToken(lockTime, lockAmount);

      await time.increaseTo(lockTime - MAXTIME / 2);

      await ve.connect(alice).quitLockWrappedToken();

      expect(await ve.balanceOf(alice.address)).to.equal(0);
      assertBNClosePercent(
        await wGNET.balanceOf(alice.address),
        lockAmount / 2n,
        '2',
      );
      assertBNClosePercent(
        await ve.penaltyAccumulated(),
        lockAmount / 2n,
        '2',
      );
    });
  });
});
