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
import type { UniswapV2Factory } from '../../typechain-types/contracts/UniswapV2Factory';
import type { UniswapV2Router02 } from '../../typechain-types/contracts/UniswapV2Router02';
import type { MockERC20 } from '../../typechain-types/contracts/mock/MockERC20';
import type { WETH9 } from '../../typechain-types/contracts/mock/WETH9';
import type { MockZKKYCVerifier } from '../../typechain-types/contracts/mock/MockZKKYCVerifier';

describe("Compliant UniswapV2", function () {
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let factory: UniswapV2Factory;
  let router: UniswapV2Router02;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let weth: WETH9;
  let zkKYCVerifier: MockZKKYCVerifier;
  let zkKYC: ZkCertificate;
  let sampleInput: any;
  let circuitWasmPath: string;
  let circuitZkeyPath: string;
  let mockZkCertificateRegistry: MockZkCertificateRegistry;
  let guardianRegistry: GuardianRegistry;

  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
  const INITIAL_LIQUIDITY = ethers.utils.parseEther("10000");

  before(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock WETH
    const WETH = await ethers.getContractFactory("WETH9");
    weth = await WETH.deploy() as WETH9;

    // Deploy mock ZKKYCVerifier
    const ZKKYCVerifier = await ethers.getContractFactory("MockZKKYCVerifier");
    zkKYCVerifier = await ZKKYCVerifier.deploy() as MockZKKYCVerifier;

    // Deploy Factory
    const Factory = await ethers.getContractFactory("UniswapV2Factory");
    factory = await Factory.deploy(await owner.getAddress()) as UniswapV2Factory;

    // Deploy Router
    const Router = await ethers.getContractFactory("UniswapV2Router02");
    router = await Router.deploy(factory.address, weth.address, zkKYCVerifier.address) as UniswapV2Router02;

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("MockERC20");
    tokenA = await MockToken.deploy("Token A", "TKA", INITIAL_SUPPLY) as MockERC20;
    tokenB = await MockToken.deploy("Token B", "TKB", INITIAL_SUPPLY) as MockERC20;

    // Approve router to spend tokens
    await tokenA.approve(router.address, ethers.constants.MaxUint256);
    await tokenB.approve(router.address, ethers.constants.MaxUint256);

    // Deploy MockZkCertificateRegistry
    const mockZkCertificateRegistryFactory = await ethers.getContractFactory(
      'MockZkCertificateRegistry',
      owner,
    );
    mockZkCertificateRegistry = await mockZkCertificateRegistryFactory.deploy() as MockZkCertificateRegistry;

    // Deploy GuardianRegistry
    const guardianRegistryFactory = await ethers.getContractFactory(
      'GuardianRegistry',
      owner,
    );
    guardianRegistry = await guardianRegistryFactory.deploy(
      'https://example.com/metadata',
    ) as GuardianRegistry;
    await guardianRegistry.deployed();

    await mockZkCertificateRegistry.setGuardianRegistry(
      guardianRegistry.address,
    );

    // Generate sample ZkKYC and proof input
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(
      zkKYC,
      0,
      router.address,
    );

    circuitWasmPath = './circuits/build/zkKYC.wasm';
    circuitZkeyPath = './circuits/build/zkKYC.zkey';

    // Grant guardian role to owner
    const { providerData } = zkKYC;
    await guardianRegistry.grantGuardianRole(
      await owner.getAddress(),
      [providerData.ax, providerData.ay],
      'https://example.com/guardian-metadata',
    );
  });

  async function generateAndProcessProof(signer: Signer) {
    const signerAddress = await signer.getAddress();
    const input = { ...sampleInput, userAddress: signerAddress };
    const { proof, publicSignals } = await groth16.fullProve(
      input,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const [piA, piB, piC] = processProof(proof);
    const publicInputs = processPublicSignals(publicSignals);

    const publicRoot = publicSignals[0]; // Assuming INDEX_ROOT is 0
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    const publicTime = parseInt(publicSignals[1], 10); // Assuming INDEX_CURRENT_TIME is 1
    await ethers.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await ethers.provider.send('evm_mine', []);

    return { piA, piB, piC, publicInputs };
  }

  it("Should create a pair and add liquidity", async function () {
    const { piA, piB, piC, publicInputs } = await generateAndProcessProof(owner);

    await router.addLiquidity(
      tokenA.address,
      tokenB.address,
      INITIAL_LIQUIDITY,
      INITIAL_LIQUIDITY,
      0,
      0,
      await owner.getAddress(),
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
