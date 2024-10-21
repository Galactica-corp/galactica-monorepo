import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { groth16 } from 'snarkjs';
import {
  fromDecToHex,
  fromHexToBytes32,
  processProof,
  processPublicSignals,
} from '../../lib/helpers';
import type { ZkCertificate } from '../../lib/zkCertificate';
import {
  generateSampleZkKYC,
  generateZkKYCProofInput,
} from '../../scripts/generateZkKYCInput';
import type { GuardianRegistry } from '../../typechain-types/contracts/GuardianRegistry';
import type { MockZkCertificateRegistry } from '../../typechain-types/contracts/mock/MockZkCertificateRegistry';
import type { MockZkKYC } from '../../typechain-types/contracts/mock/MockZkKYC';
import type { MockToken } from '../../typechain-types/contracts/mock/MockToken';
import type { WETH9 } from '../../typechain-types/contracts/dapps/CompliantDex/WETH9';
import type { UniswapV2Factory } from '../../typechain-types/contracts/dapps/CompliantDex/UniswapV2Factory';
import type { UniswapV2Router02 } from '../../typechain-types/contracts/dapps/CompliantDex/UniswapV2Router02';
import type { ZkKYCVerifier } from '../../typechain-types/contracts/verifierWrappers/ZkKYCVerifier';

describe("Compliant UniswapV2", function () {
  let deployer: Signer;
  let user1: Signer;
  let user2: Signer;
  let factory: UniswapV2Factory;
  let router: UniswapV2Router02;
  let tokenA: MockToken;
  let tokenB: MockToken;
  let weth: WETH9;
  let mockZkKYC: MockZkKYC;
  let sampleInput: any;
  let circuitWasmPath: string;
  let circuitZkeyPath: string;

  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
  const INITIAL_LIQUIDITY = ethers.utils.parseEther("10000");

  before(async function () {
    [deployer, user1, user2] = await ethers.getSigners();

    // Deploy mock WETH
    const WETH = await ethers.getContractFactory("WETH9");
    weth = await WETH.deploy() as WETH9;

    const mockZkKYCFactory = await ethers.getContractFactory(
      'MockZkKYC',
      deployer,
    );
    const mockZkKYC = await mockZkKYCFactory.deploy();

    // Deploy Factory
    const Factory = await ethers.getContractFactory("UniswapV2Factory");
    factory = await Factory.deploy(await deployer.getAddress()) as UniswapV2Factory;

    // Deploy Router
    const Router = await ethers.getContractFactory("UniswapV2Router02");
    router = await Router.deploy(factory.address, weth.address, mockZkKYC.address) as UniswapV2Router02;

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("MockToken");
    tokenA = await MockToken.deploy(deployer.address) as MockToken;
    tokenB = await MockToken.deploy(deployer.address) as MockToken;

    // Approve router to spend tokens
    await tokenA.approve(router.address, ethers.constants.MaxUint256);
    await tokenB.approve(router.address, ethers.constants.MaxUint256);

    // Generate sample ZkKYC and proof input
    let zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(
      zkKYC,
      0,
      router.address,
    );

    circuitWasmPath = './circuits/build/zkKYC.wasm';
    circuitZkeyPath = './circuits/build/zkKYC.zkey';

  });

  async function generateAndProcessProof(input: any, circuitWasmPath: string, circuitZkeyPath: string) {
    const { proof, publicSignals } = await groth16.fullProve(
      input,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const [piA, piB, piC] = processProof(proof);
    const publicInputs = processPublicSignals(publicSignals);

    const publicTime = parseInt(publicSignals[6], 10); // Assuming INDEX_CURRENT_TIME is 1

    await ethers.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await ethers.provider.send('evm_mine', []);

    return { piA, piB, piC, publicInputs };
  }

  it.only("Should create a pair and add liquidity", async function () {
    const { piA, piB, piC, publicInputs } = await generateAndProcessProof(sampleInput, circuitWasmPath, circuitZkeyPath);

    await router.addLiquidity(
      tokenA.address,
      tokenB.address,
      INITIAL_LIQUIDITY,
      INITIAL_LIQUIDITY,
      0,
      0,
      deployer.address,
      ethers.constants.MaxUint256,
      piA, piB, piC, publicInputs
    );

    const pairAddress = await factory.getPair(tokenA.address, tokenB.address);
    const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);

    expect(await pair.token0()).to.equal(tokenA.address);
    expect(await pair.token1()).to.equal(tokenB.address);
    expect(await pair.balanceOf(await owner.getAddress())).to.be.gt(0);
  });

  it("Should swap tokens", async function () {
    const { piA, piB, piC, publicInputs } = await generateAndProcessProof(user1);
    const amountIn = ethers.utils.parseEther("100");
    const path = [tokenA.address, tokenB.address];

    await tokenA.transfer(await user1.getAddress(), amountIn);
    await tokenA.connect(user1).approve(router.address, amountIn);

    const balanceBefore = await tokenB.balanceOf(await user1.getAddress());

    await router.connect(user1).swapExactTokensForTokens(
      amountIn,
      0,
      path,
      await user1.getAddress(),
      ethers.constants.MaxUint256,
      piA, piB, piC, publicInputs
    );

    const balanceAfter = await tokenB.balanceOf(await user1.getAddress());
    expect(balanceAfter).to.be.gt(balanceBefore);
  });

  it("Should fail with invalid ZKKYC proof", async function () {
    const invalidProof = {
      piA: [0, 0],
      piB: [[0, 0], [0, 0]],
      piC: [0, 0],
      publicInputs: [0, 0, 0, 0, 0]
    };

    await expect(
      router.addLiquidity(
        tokenA.address,
        tokenB.address,
        INITIAL_LIQUIDITY,
        INITIAL_LIQUIDITY,
        0,
        0,
        await owner.getAddress(),
        ethers.constants.MaxUint256,
        invalidProof.piA, invalidProof.piB, invalidProof.piC, invalidProof.publicInputs
      )
    ).to.be.revertedWith("UniswapV2Router: INVALID_ZKKYC_PROOF");
  });
});
