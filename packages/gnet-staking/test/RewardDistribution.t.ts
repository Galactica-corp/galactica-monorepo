import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre, { ethers, ignition } from 'hardhat';

import rewardDistributorModule from '../ignition/modules/RewardDistributor.m';
import type { IMerkleLeaf } from '../lib/rewardDistribution/merkleTree';
import { MerkleTree } from '../lib/rewardDistribution/merkleTree';
import type { RewardDistributor } from '../typechain-types/contracts/RewardDistributor';

describe('RewardDistributor', function () {
  /**
   * Deploy the reward distributor contract with WGNET10 as reward token.
   *
   * @returns Objects to run tests on.
   */
  async function deployFixture() {
    const [owner, assetManager, user, user2, user3, user4] =
      await hre.ethers.getSigners();

    const rewardToken = await ethers.deployContract('WGNET10');

    // Deploy RewardDistributor using Ignition
    const { rewardDistributor } = await ignition.deploy(
      rewardDistributorModule,
      {
        parameters: {
          RewardDistributorModule: {
            owner: owner.address,
            assetManager: assetManager.address,
            rewardToken: await rewardToken.getAddress(),
          },
          TimelockControllerModule: {
            // set the timelock duration to 0, so that the upgrade can be executed immediately for the unittest
            minDelay: 0,
          },
        },
      },
    );

    // Fund assetManager with ETH and deposit to get WGNET10 tokens
    const fundingAmount = ethers.parseEther('100000000');
    // Set balance higher to account for gas fees
    const balanceWithGas = fundingAmount + ethers.parseEther('1000');
    await ethers.provider.send('hardhat_setBalance', [
      assetManager.address,
      `0x${balanceWithGas.toString(16)}`,
    ]);

    // Deposit ETH to get WGNET10 tokens
    await rewardToken.connect(assetManager).deposit({ value: fundingAmount });

    return {
      rewardDistributor: rewardDistributor as unknown as RewardDistributor,
      rewardToken,
      owner,
      assetManager,
      user,
      user2,
      user3,
      user4,
    };
  }

  /**
   * Deploy the reward distributor contract with native tokens (ETH) as reward token.
   *
   * @returns Objects to run tests on.
   */
  async function deployFixtureNativeToken() {
    const [owner, assetManager, user, user2, user3, user4] =
      await hre.ethers.getSigners();

    // Deploy RewardDistributor using Ignition with zero address as rewardToken
    const { rewardDistributor } = await ignition.deploy(
      rewardDistributorModule,
      {
        parameters: {
          RewardDistributorModule: {
            owner: owner.address,
            assetManager: assetManager.address,
            rewardToken: ethers.ZeroAddress,
          },
          TimelockControllerModule: {
            // set the timelock duration to 0, so that the upgrade can be executed immediately for the unittest
            minDelay: 0,
          },
        },
      },
    );

    // Fund assetManager with ETH
    const fundingAmount = ethers.parseEther('100000000');
    // Set balance higher to account for gas fees
    const balanceWithGas = fundingAmount + ethers.parseEther('1000');
    await ethers.provider.send('hardhat_setBalance', [
      assetManager.address,
      `0x${balanceWithGas.toString(16)}`,
    ]);

    return {
      rewardDistributor: rewardDistributor as unknown as RewardDistributor,
      owner,
      assetManager,
      user,
      user2,
      user3,
      user4,
    };
  }

  it('check initialization and authorization', async function () {
    const { rewardDistributor, rewardToken, owner, assetManager, user } =
      await loadFixture(deployFixture);

    // check that the variables are initialized correctly
    expect(await rewardDistributor.owner()).to.be.equal(owner.address);
    expect(await rewardDistributor.assetManager()).to.be.equal(
      assetManager.address,
    );
    expect(await rewardDistributor.rewardToken()).to.be.equal(
      await rewardToken.getAddress(),
    );
    expect(await rewardDistributor.currentEpoch()).to.be.equal(0);
    expect(await rewardDistributor.totalRewardClaimed()).to.be.equal(0);

    // unauthorized user cannot call functions with owner or assetManager access
    await expect(
      rewardDistributor.connect(user).changeAssetManager(user.address),
    ).to.be.revertedWith(
      'RewardDistributor: Only asset manager can call this function.',
    );
    await expect(
      rewardDistributor.connect(user).withdrawETH(),
    ).to.be.revertedWith(
      'RewardDistributor: Only asset manager can call this function.',
    );
    await expect(
      rewardDistributor
        .connect(user)
        .withdrawERC20(await rewardToken.getAddress()),
    ).to.be.revertedWith(
      'RewardDistributor: Only asset manager can call this function.',
    );
    await expect(
      rewardDistributor
        .connect(user)
        .updateRewardMerkleRoot(ethers.keccak256('0x')),
    ).to.be.revertedWithCustomError(
      rewardDistributor,
      'OwnableUnauthorizedAccount',
    );
    await expect(
      rewardDistributor
        .connect(user)
        .changeFalseRewardMerkleRoot(ethers.keccak256('0x')),
    ).to.be.revertedWithCustomError(
      rewardDistributor,
      'OwnableUnauthorizedAccount',
    );
    await expect(
      rewardDistributor.connect(user).changeRewardToken(user.address),
    ).to.be.revertedWithCustomError(
      rewardDistributor,
      'OwnableUnauthorizedAccount',
    );
  });

  it('user can claim the correct amount', async function () {
    const {
      rewardDistributor,
      rewardToken,
      owner,
      assetManager,
      user,
      user2,
      user3,
      user4,
    } = await loadFixture(deployFixture);

    // data for the first epoch
    const merkleLeaves: IMerkleLeaf[] = [
      {
        index: 0n,
        address: user.address,
        amount: ethers.parseEther('1'),
        proof: [],
      },
      {
        index: 1n,
        address: user2.address,
        amount: ethers.parseEther('2'),
        proof: [],
      },
      {
        index: 2n,
        address: user3.address,
        amount: ethers.parseEther('3'),
        proof: [],
      },
      {
        index: 3n,
        address: user4.address,
        amount: ethers.parseEther('4'),
        proof: [],
      },
    ];

    // we build a merkle tree from these data
    const merkleTree = new MerkleTree();
    merkleTree.buildMerkleTreeForRewardsDistribution(merkleLeaves);

    // we set the new reward merkle root accordingly
    await rewardDistributor
      .connect(owner)
      .updateRewardMerkleRoot(merkleTree.merkleRootHash);
    // we check that the states are set correctly
    expect(await rewardDistributor.rewardMerkleRoot()).to.be.equal(
      merkleTree.merkleRootHash,
    );
    expect(await rewardDistributor.currentEpoch()).to.be.equal(1);

    // claim input in epoch 1 for user 1
    const claimInput = {
      leafIndex: merkleLeaves[0].index,
      account: merkleLeaves[0].address,
      amount: merkleLeaves[0].amount,
      merkleProof: merkleTree.getProof(0),
    };

    // check outstanding reward for user 1
    let outstandingReward =
      await rewardDistributor.userUnclaimedReward(claimInput);
    expect(outstandingReward).to.be.equal(merkleLeaves[0].amount);

    // we check that other user cannot claim user 1's reward by using function claimRewardToOtherAddress
    await expect(
      rewardDistributor
        .connect(user2)
        .claimRewardToOtherAddress(claimInput, user2.address),
    ).to.be.revertedWith('RewardDistributor: Invalid account.');

    // we send some WGNET10 to the reward distributor contract
    await rewardToken
      .connect(assetManager)
      .transfer(
        await rewardDistributor.getAddress(),
        ethers.parseEther('1000'),
      );

    // claim reward
    let userBalanceBeforeClaiming = await rewardToken.balanceOf(user.address);
    let totalRewardClaimedBefore = await rewardDistributor.totalRewardClaimed();

    await expect(rewardDistributor.connect(user).claimReward(claimInput))
      .to.emit(rewardDistributor, 'ClaimReward')
      .withArgs(
        merkleTree.merkleRootHash,
        user.address,
        claimInput.account,
        claimInput.leafIndex,
        claimInput.amount,
      );
    let userBalanceAfterClaiming = await rewardToken.balanceOf(user.address);

    let totalRewardClaimedAfter = await rewardDistributor.totalRewardClaimed();

    expect(userBalanceBeforeClaiming + claimInput.amount).to.be.equal(
      userBalanceAfterClaiming,
    );
    expect(totalRewardClaimedBefore + claimInput.amount).to.be.equal(
      totalRewardClaimedAfter,
    );
    expect(
      await rewardDistributor.userTotalRewardClaimed(user.address),
    ).to.be.equal(claimInput.amount);
    expect(
      await rewardDistributor.userLastClaimedEpoch(user.address),
    ).to.be.equal(1);

    // check that the claimInput cannot be reused to claim additional reward
    await rewardDistributor.connect(user).claimReward(claimInput);
    const userBalanceAfterClaiming2 = await rewardToken.balanceOf(user.address);
    expect(userBalanceAfterClaiming).to.be.equal(userBalanceAfterClaiming2);

    // data for the second epoch, we use addition in the amounts to emphasize the cumulation
    const merkleLeaves2: IMerkleLeaf[] = [
      {
        index: 0n,
        address: user.address,
        amount: ethers.parseEther('1') + ethers.parseEther('9'),
        proof: [],
      },
      {
        index: 1n,
        address: user2.address,
        amount: ethers.parseEther('2') + ethers.parseEther('7'),
        proof: [],
      },
      {
        index: 2n,
        address: user3.address,
        amount: ethers.parseEther('3') + ethers.parseEther('5'),
        proof: [],
      },
      {
        index: 3n,
        address: user4.address,
        amount: ethers.parseEther('4') + ethers.parseEther('3'),
        proof: [],
      },
    ];

    // we build a merkle tree from these data
    const merkleTree2 = new MerkleTree();
    merkleTree2.buildMerkleTreeForRewardsDistribution(merkleLeaves2);

    // we set the new reward merkle root accordingly
    await rewardDistributor
      .connect(owner)
      .updateRewardMerkleRoot(merkleTree2.merkleRootHash);
    // we check that the states are set correctly
    expect(await rewardDistributor.rewardMerkleRoot()).to.be.equal(
      merkleTree2.merkleRootHash,
    );
    expect(await rewardDistributor.currentEpoch()).to.be.equal(2);

    // claim input in epoch 2 for user 1
    const claimInput2 = {
      leafIndex: merkleLeaves2[0].index,
      account: merkleLeaves2[0].address,
      amount: merkleLeaves2[0].amount,
      merkleProof: merkleTree2.getProof(0),
    };

    // claim input in epoch 2 for user 2
    const claimInput3 = {
      leafIndex: merkleLeaves2[1].index,
      account: merkleLeaves2[1].address,
      amount: merkleLeaves2[1].amount,
      merkleProof: merkleTree2.getProof(1),
    };

    // check outstanding reward for user 1
    outstandingReward =
      await rewardDistributor.userUnclaimedReward(claimInput2);
    expect(outstandingReward).to.be.equal(
      merkleLeaves2[0].amount - merkleLeaves[0].amount,
    );

    // make sure that the old proof cannot be used with the new merkle root
    await expect(
      rewardDistributor.connect(user).claimReward(claimInput),
    ).to.be.revertedWith('RewardDistributor: Invalid merkle proof.');

    // claim reward, make sure that user 1 only claims reward from the 2nd epoch as he has already claimed the first one
    // here we also utilize the option to send to another address (user3)
    userBalanceBeforeClaiming = await rewardToken.balanceOf(user3.address);
    totalRewardClaimedBefore = await rewardDistributor.totalRewardClaimed();

    const expectedAmount = claimInput2.amount - claimInput.amount;
    await expect(
      rewardDistributor
        .connect(user)
        .claimRewardToOtherAddress(claimInput2, user3.address),
    )
      .to.emit(rewardDistributor, 'ClaimReward')
      .withArgs(
        merkleTree2.merkleRootHash,
        user3.address,
        claimInput.account,
        claimInput.leafIndex,
        expectedAmount,
      );
    userBalanceAfterClaiming = await rewardToken.balanceOf(user3.address);
    totalRewardClaimedAfter = await rewardDistributor.totalRewardClaimed();

    expect(userBalanceBeforeClaiming + expectedAmount).to.be.equal(
      userBalanceAfterClaiming,
    );
    expect(totalRewardClaimedBefore + expectedAmount).to.be.equal(
      totalRewardClaimedAfter,
    );
    expect(
      await rewardDistributor.userTotalRewardClaimed(user.address),
    ).to.be.equal(claimInput2.amount);
    expect(
      await rewardDistributor.userLastClaimedEpoch(user.address),
    ).to.be.equal(2);

    // claim reward for user 2 and make sure that he receives reward for both epochs
    // we also utilize the option that user 4 can claim for user 2 (reward can only go to user 2 though)

    userBalanceBeforeClaiming = await rewardToken.balanceOf(user2.address);
    totalRewardClaimedBefore = await rewardDistributor.totalRewardClaimed();

    await expect(rewardDistributor.connect(user4).claimReward(claimInput3))
      .to.emit(rewardDistributor, 'ClaimReward')
      .withArgs(
        merkleTree2.merkleRootHash,
        user2.address,
        claimInput3.account,
        claimInput3.leafIndex,
        claimInput3.amount,
      );
    userBalanceAfterClaiming = await rewardToken.balanceOf(user2.address);
    totalRewardClaimedAfter = await rewardDistributor.totalRewardClaimed();

    expect(userBalanceBeforeClaiming + claimInput3.amount).to.be.equal(
      userBalanceAfterClaiming,
    );
    expect(totalRewardClaimedBefore + claimInput3.amount).to.be.equal(
      totalRewardClaimedAfter,
    );
    expect(
      await rewardDistributor.userTotalRewardClaimed(user2.address),
    ).to.be.equal(claimInput3.amount);
    expect(
      await rewardDistributor.userLastClaimedEpoch(user2.address),
    ).to.be.equal(2);
  });

  it('user can claim native tokens correctly', async function () {
    const {
      rewardDistributor,
      owner,
      assetManager,
      user,
      user2,
      user3,
      user4,
    } = await loadFixture(deployFixtureNativeToken);

    // check that the rewardToken is set to zero address
    expect(await rewardDistributor.rewardToken()).to.be.equal(
      ethers.ZeroAddress,
    );
    expect(await rewardDistributor.currentEpoch()).to.be.equal(0);
    expect(await rewardDistributor.totalRewardClaimed()).to.be.equal(0);

    // data for the first epoch
    const merkleLeaves: IMerkleLeaf[] = [
      {
        index: 0n,
        address: user.address,
        amount: ethers.parseEther('1'),
        proof: [],
      },
      {
        index: 1n,
        address: user2.address,
        amount: ethers.parseEther('2'),
        proof: [],
      },
      {
        index: 2n,
        address: user3.address,
        amount: ethers.parseEther('3'),
        proof: [],
      },
      {
        index: 3n,
        address: user4.address,
        amount: ethers.parseEther('4'),
        proof: [],
      },
    ];

    // we build a merkle tree from these data
    const merkleTree = new MerkleTree();
    merkleTree.buildMerkleTreeForRewardsDistribution(merkleLeaves);

    // we set the new reward merkle root accordingly
    await rewardDistributor
      .connect(owner)
      .updateRewardMerkleRoot(merkleTree.merkleRootHash);
    // we check that the states are set correctly
    expect(await rewardDistributor.rewardMerkleRoot()).to.be.equal(
      merkleTree.merkleRootHash,
    );
    expect(await rewardDistributor.currentEpoch()).to.be.equal(1);

    // claim input in epoch 1 for user 1
    const claimInput = {
      leafIndex: merkleLeaves[0].index,
      account: merkleLeaves[0].address,
      amount: merkleLeaves[0].amount,
      merkleProof: merkleTree.getProof(0),
    };

    // check outstanding reward for user 1
    let outstandingReward =
      await rewardDistributor.userUnclaimedReward(claimInput);
    expect(outstandingReward).to.be.equal(merkleLeaves[0].amount);

    // we check that other user cannot claim user 1's reward by using function claimRewardToOtherAddress
    await expect(
      rewardDistributor
        .connect(user2)
        .claimRewardToOtherAddress(claimInput, user2.address),
    ).to.be.revertedWith('RewardDistributor: Invalid account.');

    // we send some ETH to the reward distributor contract
    await assetManager.sendTransaction({
      to: await rewardDistributor.getAddress(),
      value: ethers.parseEther('1000'),
    });

    // claim reward
    const contractBalanceBefore = await ethers.provider.getBalance(
      await rewardDistributor.getAddress(),
    );
    let totalRewardClaimedBefore = await rewardDistributor.totalRewardClaimed();

    await expect(rewardDistributor.connect(user).claimReward(claimInput))
      .to.emit(rewardDistributor, 'ClaimReward')
      .withArgs(
        merkleTree.merkleRootHash,
        user.address,
        claimInput.account,
        claimInput.leafIndex,
        claimInput.amount,
      );
    const contractBalanceAfter = await ethers.provider.getBalance(
      await rewardDistributor.getAddress(),
    );

    let totalRewardClaimedAfter = await rewardDistributor.totalRewardClaimed();

    // Check that contract balance decreased by the exact reward amount
    expect(contractBalanceBefore - claimInput.amount).to.be.equal(
      contractBalanceAfter,
    );
    expect(totalRewardClaimedBefore + claimInput.amount).to.be.equal(
      totalRewardClaimedAfter,
    );
    expect(
      await rewardDistributor.userTotalRewardClaimed(user.address),
    ).to.be.equal(claimInput.amount);
    expect(
      await rewardDistributor.userLastClaimedEpoch(user.address),
    ).to.be.equal(1);

    // check that the claimInput cannot be reused to claim additional reward
    const contractBalanceBefore2 = await ethers.provider.getBalance(
      await rewardDistributor.getAddress(),
    );
    await rewardDistributor.connect(user).claimReward(claimInput);
    const contractBalanceAfter2 = await ethers.provider.getBalance(
      await rewardDistributor.getAddress(),
    );
    // Contract balance should not change since no new reward is claimed
    expect(contractBalanceBefore2).to.be.equal(contractBalanceAfter2);

    // data for the second epoch, we use addition in the amounts to emphasize the cumulation
    const merkleLeaves2: IMerkleLeaf[] = [
      {
        index: 0n,
        address: user.address,
        amount: ethers.parseEther('1') + ethers.parseEther('9'),
        proof: [],
      },
      {
        index: 1n,
        address: user2.address,
        amount: ethers.parseEther('2') + ethers.parseEther('7'),
        proof: [],
      },
      {
        index: 2n,
        address: user3.address,
        amount: ethers.parseEther('3') + ethers.parseEther('5'),
        proof: [],
      },
      {
        index: 3n,
        address: user4.address,
        amount: ethers.parseEther('4') + ethers.parseEther('3'),
        proof: [],
      },
    ];

    // we build a merkle tree from these data
    const merkleTree2 = new MerkleTree();
    merkleTree2.buildMerkleTreeForRewardsDistribution(merkleLeaves2);

    // we set the new reward merkle root accordingly
    await rewardDistributor
      .connect(owner)
      .updateRewardMerkleRoot(merkleTree2.merkleRootHash);
    // we check that the states are set correctly
    expect(await rewardDistributor.rewardMerkleRoot()).to.be.equal(
      merkleTree2.merkleRootHash,
    );
    expect(await rewardDistributor.currentEpoch()).to.be.equal(2);

    // claim input in epoch 2 for user 1
    const claimInput2 = {
      leafIndex: merkleLeaves2[0].index,
      account: merkleLeaves2[0].address,
      amount: merkleLeaves2[0].amount,
      merkleProof: merkleTree2.getProof(0),
    };

    // claim input in epoch 2 for user 2
    const claimInput3 = {
      leafIndex: merkleLeaves2[1].index,
      account: merkleLeaves2[1].address,
      amount: merkleLeaves2[1].amount,
      merkleProof: merkleTree2.getProof(1),
    };

    // check outstanding reward for user 1
    outstandingReward =
      await rewardDistributor.userUnclaimedReward(claimInput2);
    expect(outstandingReward).to.be.equal(
      merkleLeaves2[0].amount - merkleLeaves[0].amount,
    );

    // make sure that the old proof cannot be used with the new merkle root
    await expect(
      rewardDistributor.connect(user).claimReward(claimInput),
    ).to.be.revertedWith('RewardDistributor: Invalid merkle proof.');

    // claim reward, make sure that user 1 only claims reward from the 2nd epoch as he has already claimed the first one
    // here we also utilize the option to send to another address (user3)
    const contractBalanceBefore3 = await ethers.provider.getBalance(
      await rewardDistributor.getAddress(),
    );
    totalRewardClaimedBefore = await rewardDistributor.totalRewardClaimed();

    const expectedAmount = claimInput2.amount - claimInput.amount;
    await expect(
      rewardDistributor
        .connect(user)
        .claimRewardToOtherAddress(claimInput2, user3.address),
    ).to.changeEtherBalance(user3, expectedAmount);
    const contractBalanceAfter3 = await ethers.provider.getBalance(
      await rewardDistributor.getAddress(),
    );
    totalRewardClaimedAfter = await rewardDistributor.totalRewardClaimed();

    // Check that contract balance decreased by the exact reward amount
    expect(contractBalanceBefore3 - expectedAmount).to.be.equal(
      contractBalanceAfter3,
    );
    expect(totalRewardClaimedBefore + expectedAmount).to.be.equal(
      totalRewardClaimedAfter,
    );
    expect(
      await rewardDistributor.userTotalRewardClaimed(user.address),
    ).to.be.equal(claimInput2.amount);
    expect(
      await rewardDistributor.userLastClaimedEpoch(user.address),
    ).to.be.equal(2);

    // claim reward for user 2 and make sure that he receives reward for both epochs
    // we also utilize the option that user 4 can claim for user 2 (reward can only go to user 2 though)

    const contractBalanceBefore4 = await ethers.provider.getBalance(
      await rewardDistributor.getAddress(),
    );
    totalRewardClaimedBefore = await rewardDistributor.totalRewardClaimed();

    await expect(rewardDistributor.connect(user4).claimReward(claimInput3))
      .to.emit(rewardDistributor, 'ClaimReward')
      .withArgs(
        merkleTree2.merkleRootHash,
        user2.address,
        claimInput3.account,
        claimInput3.leafIndex,
        claimInput3.amount,
      );
    const contractBalanceAfter4 = await ethers.provider.getBalance(
      await rewardDistributor.getAddress(),
    );
    totalRewardClaimedAfter = await rewardDistributor.totalRewardClaimed();

    // Check that contract balance decreased by the exact reward amount
    expect(contractBalanceBefore4 - claimInput3.amount).to.be.equal(
      contractBalanceAfter4,
    );
    expect(totalRewardClaimedBefore + claimInput3.amount).to.be.equal(
      totalRewardClaimedAfter,
    );
    expect(
      await rewardDistributor.userTotalRewardClaimed(user2.address),
    ).to.be.equal(claimInput3.amount);
    expect(
      await rewardDistributor.userLastClaimedEpoch(user2.address),
    ).to.be.equal(2);
  });
});
