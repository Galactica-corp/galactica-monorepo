import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import type { UniswapV2Factory } from '../../typechain-types/contracts/dapps/CompliantDex/UniswapV2Factory';
import type { UniswapV2Router02 } from '../../typechain-types/contracts/dapps/CompliantDex/UniswapV2Router02';
import type { WETH9 } from '../../typechain-types/contracts/dapps/CompliantDex/WETH9';
import type { MockToken } from '../../typechain-types/contracts/mock/MockToken';
import type { MockZkKYC } from '../../typechain-types/contracts/mock/MockZkKYC';
import type { VerificationSBT } from '../../typechain-types/contracts/VerificationSBT';

describe('Compliant UniswapV2', function () {
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let factory: UniswapV2Factory;
  let router: UniswapV2Router02;
  let tokenA: MockToken;
  let tokenB: MockToken;
  let weth: WETH9;
  let mockZkKYC: MockZkKYC;
  let verificationSBT: VerificationSBT;

  const INITIAL_SUPPLY = ethers.utils.parseEther('10000');
  const INITIAL_LIQUIDITY = ethers.utils.parseEther('1000');

  before(async function () {
    [deployer, user1, user2] = await ethers.getSigners();

    // Deploy mock WETH
    const WETH = await ethers.getContractFactory('WETH9');
    weth = (await WETH.deploy()) as WETH9;

    const mockZkKYCFactory = await ethers.getContractFactory(
      'MockZkKYC',
      deployer,
    );
    mockZkKYC = (await mockZkKYCFactory.deploy()) as MockZkKYC;

    // Deploy VerificationSBT
    const VerificationSBTFactory =
      await ethers.getContractFactory('VerificationSBT');
    verificationSBT = (await VerificationSBTFactory.deploy(
      'VerificationSBT',
      'VSBT',
      'https://example.com/token/',
    )) as VerificationSBT;

    // Deploy Factory
    const Factory = await ethers.getContractFactory('UniswapV2Factory');
    factory = (await Factory.deploy(deployer.address)) as UniswapV2Factory;

    // Deploy Router
    const Router = await ethers.getContractFactory('UniswapV2Router02');
    router = (await Router.deploy(
      factory.address,
      weth.address,
      mockZkKYC.address,
      verificationSBT.address,
      [mockZkKYC.address],
    )) as UniswapV2Router02;

    // Set router
    await factory.setRouter(router.address);

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory('MockToken');
    tokenA = (await MockToken.deploy(deployer.address)) as MockToken;
    tokenB = (await MockToken.deploy(deployer.address)) as MockToken;

    // Transfer tokens to users
    await tokenA.transfer(user1.address, INITIAL_SUPPLY);
    await tokenB.transfer(user1.address, INITIAL_SUPPLY);
    await tokenA.transfer(user2.address, INITIAL_SUPPLY);
    await tokenB.transfer(user2.address, INITIAL_SUPPLY);

    // Approve router to spend tokens for users
    await tokenA
      .connect(user1)
      .approve(router.address, ethers.constants.MaxUint256);
    await tokenB
      .connect(user1)
      .approve(router.address, ethers.constants.MaxUint256);
    await tokenA
      .connect(user2)
      .approve(router.address, ethers.constants.MaxUint256);
    await tokenB
      .connect(user2)
      .approve(router.address, ethers.constants.MaxUint256);
  });

  it.only('should register user, add liquidity, remove liquidity, and swap tokens', async function () {
    // compliantUser passes KYC requirements
    const expirationTime = Math.floor(Date.now() / 1000) * 2;
    await mockZkKYC
      .connect(user1)
      .earnVerificationSBT(
        verificationSBT.address,
        expirationTime,
        [],
        [0, 0],
        ethers.utils.hexZeroPad('0x1', 32),
        [3, 4],
      );

    // Verify that the VerificationSBT was minted
    expect(await verificationSBT.balanceOf(user1.address)).to.equal(1);

    await factory.createPair(tokenA.address, tokenB.address);

    // Add liquidity
    await router
      .connect(user1)
      .addLiquidity(
        tokenA.address,
        tokenB.address,
        INITIAL_LIQUIDITY,
        INITIAL_LIQUIDITY,
        0,
        0,
        user1.address,
        ethers.constants.MaxUint256,
      );

    const pairAddress = await factory.getPair(tokenA.address, tokenB.address);
    const pair = await ethers.getContractAt('UniswapV2Pair', pairAddress);

    const pairBalanceA = await tokenA.balanceOf(pairAddress);
    const pairBalanceB = await tokenB.balanceOf(pairAddress);
    expect(pairBalanceA).to.be.equal(INITIAL_LIQUIDITY);
    expect(pairBalanceB).to.be.equal(INITIAL_LIQUIDITY);
    const lpTokenBalance = await pair.balanceOf(user1.address);
    expect(lpTokenBalance).to.be.gt(0);
    const removeBalance = lpTokenBalance.div(2);

    // Remove liquidity
    await pair.connect(user1).approve(router.address, lpTokenBalance);
    await router
      .connect(user1)
      .removeLiquidity(
        tokenA.address,
        tokenB.address,
        removeBalance,
        0,
        0,
        user1.address,
        ethers.constants.MaxUint256,
      );

    const pairBalanceAAfterRemove = await tokenA.balanceOf(pairAddress);
    const pairBalanceBAfterRemove = await tokenB.balanceOf(pairAddress);
    expect(pairBalanceAAfterRemove).to.be.lt(INITIAL_LIQUIDITY);
    expect(pairBalanceBAfterRemove).to.be.lt(INITIAL_LIQUIDITY);

    // Swap tokens
    const swapAmount = ethers.utils.parseEther('100');
    const balanceBefore = await tokenB.balanceOf(user1.address);

    await router
      .connect(user1)
      .swapExactTokensForTokens(
        swapAmount,
        0,
        [tokenA.address, tokenB.address],
        user1.address,
        ethers.constants.MaxUint256,
      );

    const balanceAfter = await tokenB.balanceOf(user1.address);
    expect(balanceAfter).to.be.gt(balanceBefore);
  });

  it('should fail operations without VerificationSBT', async function () {
    console.log('1');
    // Try to add liquidity without VerificationSBT
    await expect(
      router
        .connect(user2)
        .addLiquidity(
          tokenA.address,
          tokenB.address,
          INITIAL_LIQUIDITY,
          INITIAL_LIQUIDITY,
          0,
          0,
          user2.address,
          ethers.constants.MaxUint256,
        ),
    ).to.be.revertedWith(
      'UniswapV2Router02: Recipient does not have required compliance SBTs.',
    );

    // Try to swap tokens without VerificationSBT
    await expect(
      router
        .connect(user2)
        .swapExactTokensForTokens(
          ethers.utils.parseEther('100'),
          0,
          [tokenA.address, tokenB.address],
          user2.address,
          ethers.constants.MaxUint256,
        ),
    ).to.be.revertedWith(
      'UniswapV2Router02: Recipient does not have required compliance SBTs.',
    );
  });

  it('liquidity tokens cannot be transferred to non-compliant addresses', async function () {
    // compliantUser passes KYC requirements
    const expirationTime = Math.floor(Date.now() / 1000) * 2;
    await mockZkKYC
      .connect(user1)
      .earnVerificationSBT(
        verificationSBT.address,
        expirationTime,
        [],
        [0, 0],
        ethers.utils.hexZeroPad('0x1', 32),
        [3, 4],
      );

    // Verify that the VerificationSBT was minted
    expect(await verificationSBT.balanceOf(user1.address)).to.equal(1);

    await factory.createPair(tokenA.address, tokenB.address);

    // Add liquidity
    await router
      .connect(user1)
      .addLiquidity(
        tokenA.address,
        tokenB.address,
        INITIAL_LIQUIDITY,
        INITIAL_LIQUIDITY,
        0,
        0,
        user1.address,
        ethers.constants.MaxUint256,
      );

    const pairAddress = await factory.getPair(tokenA.address, tokenB.address);
    const pair = await ethers.getContractAt('UniswapV2Pair', pairAddress);
    const lpTokenBalance = await pair.balanceOf(user1.address);

    // Try to swap tokens without VerificationSBT
    await expect(
      pair.connect(user1).transfer(user2.address, lpTokenBalance),
    ).to.be.revertedWith(
      'UniswapV2ERC20: Recipient does not have required compliance SBTs.',
    );

    // now mint a new VerificationSBT for user2
    await mockZkKYC
      .connect(user2)
      .earnVerificationSBT(
        verificationSBT.address,
        expirationTime,
        [],
        [0, 0],
        ethers.utils.hexZeroPad('0x1', 32),
        [3, 4],
      );

    // now the transfer should succeed
    await pair.connect(user1).transfer(user2.address, lpTokenBalance);

    expect(await pair.balanceOf(user2.address)).to.equal(lpTokenBalance);
  });
});
