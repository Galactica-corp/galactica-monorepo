/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import chai from 'chai';
import hre, { ethers } from 'hardhat';
import { groth16 } from 'snarkjs';

import {
  fromDecToHex,
  fromHexToBytes32,
  processProof,
  processPublicSignals,
} from '../../lib/helpers';
import type { ZkCertificate } from '../../lib/zkCertificate';
import {
  generateSampleTwitterZkCertificate,
  generateTwitterZkCertificateProofInput,
} from '../../scripts/generateTwitterZkCertificateInput';
import type { MockZkCertificateRegistry } from '../../typechain-types/contracts/mock/MockZkCertificateRegistry';
import type { TwitterZkCertificate } from '../../typechain-types/contracts/TwitterZkCertificate';
import type { TwitterZkCertificateVerifier } from '../../typechain-types/contracts/zkpVerifiers/TwitterZkCertificateVerifier';

chai.config.includeStack = true;

const { expect } = chai;

describe('zkCertificate followers count proof', () => {
  // reset the testing chain so we can perform time related tests
  /* await hre.network.provider.send('hardhat_reset'); */
  let twitterFollowersCountThresholdContract: TwitterZkCertificate;
  let twitterFollowersCountThresholdVerifier: TwitterZkCertificateVerifier;
  let mockZkCertificateRegistry: MockZkCertificateRegistry;

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let twitterZkCertificate: ZkCertificate;
  let sampleInput: any, circuitWasmPath: string, circuitZkeyPath: string;

  beforeEach(async () => {
    // reset the testing chain so we can perform time related tests
    await hre.network.provider.send('hardhat_reset');

    [deployer, user, randomUser] = await hre.ethers.getSigners();

    // set up zkCertificateRegistry, GalacticaInstitution, twitterFollowersCountThresholdVerifier, twitterZkCertificate
    const mockZkCertificateRegistryFactory = await ethers.getContractFactory(
      'MockZkCertificateRegistry',
      deployer,
    );
    mockZkCertificateRegistry =
      (await mockZkCertificateRegistryFactory.deploy()) as MockZkCertificateRegistry;

    const twitterFollowersCountThresholdVerifierFactory =
      await ethers.getContractFactory(
        'TwitterFollowersCountProofVerifier',
        deployer,
      );
    twitterFollowersCountThresholdVerifier =
      (await twitterFollowersCountThresholdVerifierFactory.deploy()) as TwitterZkCertificateVerifier;

    const twitterFollowersCountThresholdFactory =
      await ethers.getContractFactory('TwitterFollowersCountProof', deployer);
    twitterFollowersCountThresholdContract =
      (await twitterFollowersCountThresholdFactory.deploy(
        await deployer.getAddress(),
        await twitterFollowersCountThresholdVerifier.getAddress(),
        await mockZkCertificateRegistry.getAddress(),
        [],
      )) as TwitterZkCertificate;

    twitterZkCertificate = await generateSampleTwitterZkCertificate();

    sampleInput =
      await generateTwitterZkCertificateProofInput(twitterZkCertificate);

    sampleInput.followersCountThreshold = 10;

    // get signer object authorized to use the zkCertificate record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    circuitWasmPath = './circuits/build/twitterFollowersCountProof.wasm';
    circuitZkeyPath = './circuits/build/twitterFollowersCountProof.zkey';
  });

  it('only owner can change ZkCertificateRegistry and Verifier addresses', async () => {
    // random user cannot change the addresses
    await expect(
      twitterFollowersCountThresholdContract
        .connect(user)
        .setVerifier(await user.getAddress()),
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(
      twitterFollowersCountThresholdContract
        .connect(user)
        .setRegistry(await user.getAddress()),
    ).to.be.revertedWith('Ownable: caller is not the owner');

    // owner can change addresses
    await twitterFollowersCountThresholdContract
      .connect(deployer)
      .setVerifier(await user.getAddress());
    await twitterFollowersCountThresholdContract
      .connect(deployer)
      .setRegistry(await user.getAddress());

    expect(await twitterFollowersCountThresholdContract.verifier()).to.be.equal(
      await user.getAddress(),
    );
    expect(await twitterFollowersCountThresholdContract.registry()).to.be.equal(
      await user.getAddress(),
    );
  });

  it('correct proof can be verified onchain', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot =
      publicSignals[await twitterFollowersCountThresholdContract.INDEX_ROOT()];
    const publicTime = parseInt(
      publicSignals[
      await twitterFollowersCountThresholdContract.INDEX_CURRENT_TIME()
      ],
      10,
    );
    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);

    await twitterFollowersCountThresholdContract
      .connect(user)
      .verifyProof(piA, piB, piC, publicInputs);
  });

  it('proof with older but still valid merkle root can still be verified', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot =
      publicSignals[await twitterFollowersCountThresholdContract.INDEX_ROOT()];
    const publicTime = parseInt(
      publicSignals[
      await twitterFollowersCountThresholdContract.INDEX_CURRENT_TIME()
      ],
      10,
    );
    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    // add a new merkle root
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex('0x11')),
    );

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await twitterFollowersCountThresholdContract
      .connect(user)
      .verifyProof(piA, piB, piC, publicInputs);
  });

  it('revert for proof with old merkle root', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot =
      publicSignals[await twitterFollowersCountThresholdContract.INDEX_ROOT()];
    const publicTime = parseInt(
      publicSignals[
      await twitterFollowersCountThresholdContract.INDEX_CURRENT_TIME()
      ],
      10,
    );
    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    // add a new merkle root
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex('0x11')),
    );

    // increase the merkleRootValidIndex
    await mockZkCertificateRegistry.setMerkleRootValidIndex(2);

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      twitterFollowersCountThresholdContract
        .connect(user)
        .verifyProof(piC, piB, piA, publicInputs),
    ).to.be.revertedWith('invalid merkle root');
  });

  it('incorrect proof failed to be verified', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot =
      publicSignals[await twitterFollowersCountThresholdContract.INDEX_ROOT()];
    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);

    // switch c, a to get an incorrect proof
    await expect(
      twitterFollowersCountThresholdContract
        .connect(user)
        .verifyProof(piC, piB, piA, publicInputs),
    ).to.be.reverted;
  });

  it('revert if proof output is invalid', async () => {
    const forgedInput = { ...sampleInput };

    // make the twitterZkCertificate record expire leading to invalid proof output
    forgedInput.currentTime = Number(forgedInput.expirationDate) + 1;

    const { proof, publicSignals } = await groth16.fullProve(
      forgedInput,
      circuitWasmPath,
      circuitZkeyPath,
    );
    expect(
      publicSignals[
      await twitterFollowersCountThresholdContract.INDEX_IS_VALID()
      ],
    ).to.be.equal('0');
    const publicRoot =
      publicSignals[await twitterFollowersCountThresholdContract.INDEX_ROOT()];
    // set the merkle root to the correct one

    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    // set time to the public time
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      twitterFollowersCountThresholdContract
        .connect(user)
        .verifyProof(piA, piB, piC, publicInputs),
    ).to.be.revertedWith('the proof output is not valid');
  });

  it('revert if public output merkle root does not match with the one onchain', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    // we don't set the merkle root to the correct one

    // set time to the public time
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      twitterFollowersCountThresholdContract
        .connect(user)
        .verifyProof(piA, piB, piC, publicInputs),
    ).to.be.revertedWith('invalid merkle root');
  });

  it('revert if time is too far from current time', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot =
      publicSignals[await twitterFollowersCountThresholdContract.INDEX_ROOT()];
    const publicTime = parseInt(
      publicSignals[
      await twitterFollowersCountThresholdContract.INDEX_CURRENT_TIME()
      ],
      10,
    );
    // set the merkle root to the correct one

    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      publicTime + 200 + 30 * 60,
    ]);

    await hre.network.provider.send('evm_mine');
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      twitterFollowersCountThresholdContract
        .connect(user)
        .verifyProof(piA, piB, piC, publicInputs),
    ).to.be.revertedWith('the current time is incorrect');
  });

  it('unauthorized user cannot use the proof', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot =
      publicSignals[await twitterFollowersCountThresholdContract.INDEX_ROOT()];
    const publicTime = parseInt(
      publicSignals[
      await twitterFollowersCountThresholdContract.INDEX_CURRENT_TIME()
      ],
      10,
    );
    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      twitterFollowersCountThresholdContract
        .connect(randomUser)
        .verifyProof(piA, piB, piC, publicInputs),
    ).to.be.revertedWith(
      'transaction submitter is not authorized to use this proof',
    );
  });

  it('invalid proof if the user followers count is less than the threshold', async () => {
    const forgedInput = { ...sampleInput };

    // make the twitterZkCertificate record having less followers
    forgedInput.followersCountThreshold = 100000;

    const { proof, publicSignals } = await groth16.fullProve(
      forgedInput,
      circuitWasmPath,
      circuitZkeyPath,
    );
    expect(
      publicSignals[
      await twitterFollowersCountThresholdContract.INDEX_IS_VALID()
      ],
    ).to.be.equal('0');
    const publicRoot =
      publicSignals[await twitterFollowersCountThresholdContract.INDEX_ROOT()];
    // set the merkle root to the correct one

    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );
    // set time to the public time
    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    await expect(
      twitterFollowersCountThresholdContract
        .connect(user)
        .verifyProof(piA, piB, piC, publicInputs),
    ).to.be.revertedWith('the proof output is not valid');
  });
});
