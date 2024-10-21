import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { groth16 } from 'snarkjs';

import { processProof, processPublicSignals } from '../../lib/helpers';
import {
  generateSampleZkKYC,
  generateZkKYCProofInput,
} from '../../scripts/generateZkKYCInput';
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
  let sampleInput: any;
  let circuitWasmPath: string;
  let circuitZkeyPath: string;

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
    factory = (await Factory.deploy(
      await deployer.getAddress(),
    )) as UniswapV2Factory;

    // Deploy Router
    const Router = await ethers.getContractFactory('UniswapV2Router02');
    router = (await Router.deploy(
      factory.address,
      weth.address,
      mockZkKYC.address,
      verificationSBT.address,
    )) as UniswapV2Router02;

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

    // Generate sample ZkKYC and proof input
    const zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(zkKYC, 0, router.address);

    circuitWasmPath = './circuits/build/zkKYC.wasm';
    circuitZkeyPath = './circuits/build/zkKYC.zkey';
  });

  /**
   * Generates and processes a proof for the given input.
   * @param input - The input data for generating the proof.
   * @param wasmPath - The path to the circuit WASM file.
   * @param zkeyPath - The path to the circuit zkey file.
   * @returns An object containing the processed proof and public inputs.
   */
  async function generateAndProcessProof(
    input: any,
    wasmPath: string,
    zkeyPath: string,
  ) {
    const { proof, publicSignals } = await groth16.fullProve(
      input,
      wasmPath,
      zkeyPath,
    );

    const [piA, piB, piC] = processProof(proof);
    const publicInputs = processPublicSignals(publicSignals);

    const publicTime = parseInt(publicSignals[6], 10); // Assuming INDEX_CURRENT_TIME is 1

    await ethers.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await ethers.provider.send('evm_mine', []);

    return { piA, piB, piC, publicInputs };
  }

  it('should register user, add liquidity, remove liquidity, and swap tokens', async function () {
    const { piA, piB, piC, publicInputs } = await generateAndProcessProof(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    // Register user and mint VerificationSBT
    await router.connect(user1).register(piA, piB, piC, publicInputs);

    // Verify that the VerificationSBT was minted
    expect(await verificationSBT.balanceOf(user1.address)).to.equal(1);

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
      'UniswapV2Router: User does not have a valid VerificationSBT',
    );

    // Try to remove liquidity without VerificationSBT
    await expect(
      router
        .connect(user2)
        .removeLiquidity(
          tokenA.address,
          tokenB.address,
          INITIAL_LIQUIDITY,
          0,
          0,
          user2.address,
          ethers.constants.MaxUint256,
        ),
    ).to.be.revertedWith(
      'UniswapV2Router: User does not have a valid VerificationSBT',
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
      'UniswapV2Router: User does not have a valid VerificationSBT',
    );
  });
});
