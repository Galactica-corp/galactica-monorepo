/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import chai, { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { buildEddsa } from 'circomlibjs';
import type { BigNumberish } from 'ethers';
import hre, { ethers } from 'hardhat';
import { groth16 } from 'snarkjs';

import {
  fromDecToHex,
  fromHexToBytes32,
  processProof,
  processPublicSignals,
} from '../../lib/helpers';
import { getEddsaKeyFromEthSigner } from '../../lib/keyManagement';
import { queryVerificationSBTs } from '../../lib/queryVerificationSBT';
import { decryptFraudInvestigationData } from '../../lib/SBTData';
import { reconstructShamirSecret } from '../../lib/shamirTools';
import type { ZkCertificate } from '../../lib/zkCertificate';
import {
  generateSampleZkKYC,
  generateZkKYCProofInput,
} from '../../scripts/dev/generateZkKYCInput';
import type { GuardianRegistry, MockToken } from '../../typechain-types';
import type { MockDApp } from '../../typechain-types/contracts/mock/MockDApp';
import type { MockGalacticaInstitution } from '../../typechain-types/contracts/mock/MockGalacticaInstitution';
import type { MockZkCertificateRegistry } from '../../typechain-types/contracts/mock/MockZkCertificateRegistry';
import type { VerificationSBT } from '../../typechain-types/contracts/SBT_related/VerificationSBT';
import type { AgeCitizenshipKYC } from '../../typechain-types/contracts/verifierWrappers/AgeCitizenshipKYC';
import type { ExampleMockDAppVerifier } from '../../typechain-types/contracts/zkpVerifiers/ExampleMockDAppVerifier';

use(chaiAsPromised);

chai.config.includeStack = true;

describe('Verification SBT Smart contract', () => {
  let ageProofZkKYC: AgeCitizenshipKYC;
  let exampleMockDAppVerifier: ExampleMockDAppVerifier;
  let mockZkCertificateRegistry: MockZkCertificateRegistry;
  let mockGalacticaInstitutions: MockGalacticaInstitution[];
  const amountInstitutions = 3;
  let mockDApp: MockDApp;
  let verificationSBT: VerificationSBT;
  let token1, token2;

  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let encryptionAccount: SignerWithAddress;
  const institutions: SignerWithAddress[] = [];
  let zkKYC: ZkCertificate;
  let sampleInput: any;
  let circuitWasmPath: string;
  let circuitZkeyPath: string;
  let guardianRegistry: GuardianRegistry;

  beforeEach(async () => {
    // reset the testing chain so we can perform time related tests
    await hre.network.provider.send('hardhat_reset');

    [deployer, user, encryptionAccount] = await hre.ethers.getSigners();
    for (let i = 0; i < amountInstitutions; i++) {
      institutions.push((await ethers.getSigners())[4 + i]);
    }

    // set up KYCRegistry, ZkKYCVerifier, ZkKYC
    mockZkCertificateRegistry = (await ethers.deployContract(
      'MockZkCertificateRegistry',
    )) as MockZkCertificateRegistry;

    mockGalacticaInstitutions = [];
    for (let i = 0; i < amountInstitutions; i++) {
      mockGalacticaInstitutions.push(
        (await ethers.deployContract(
          'MockGalacticaInstitution',
        )) as MockGalacticaInstitution,
      );
    }

    exampleMockDAppVerifier = (await ethers.deployContract(
      'ExampleMockDAppVerifier',
    )) as ExampleMockDAppVerifier;

    ageProofZkKYC = (await ethers.deployContract('AgeCitizenshipKYC', [
      deployer.address,
      await exampleMockDAppVerifier.getAddress(),
      await mockZkCertificateRegistry.getAddress(),
      [],
      await Promise.all(
        mockGalacticaInstitutions.map(async (inst) => inst.getAddress()),
      ),
      0,
    ])) as AgeCitizenshipKYC;

    mockDApp = (await ethers.deployContract('MockDApp', [
      await ageProofZkKYC.getAddress(),
      'https://example.com/metadata',
      'VerificationSBT',
      'VerificationSBT',
    ])) as MockDApp;

    verificationSBT = (await ethers.getContractAt(
      'VerificationSBT',
      await mockDApp.sbt(),
    )) as VerificationSBT;

    token1 = (await ethers.deployContract('MockToken', [
      await mockDApp.getAddress(),
    ])) as MockToken;
    token2 = (await ethers.deployContract('MockToken', [
      await mockDApp.getAddress(),
    ])) as MockToken;

    await mockDApp.setToken1(await token1.getAddress());
    await mockDApp.setToken2(await token2.getAddress());

    // inputs to create proof
    zkKYC = await generateSampleZkKYC();
    sampleInput = await generateZkKYCProofInput(
      zkKYC,
      amountInstitutions,
      await mockDApp.getAddress(),
    );
    const today = new Date(Date.now());
    sampleInput.currentYear = today.getUTCFullYear();
    sampleInput.currentMonth = today.getUTCMonth() + 1;
    sampleInput.currentDay = today.getUTCDate();
    sampleInput.ageThreshold = 18;

    // advance time a bit to set it later in the test
    sampleInput.currentTime += 100;

    // get signer object authorized to use the zkKYC record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    // get signer object authorized to use the zkKYC record
    user = await hre.ethers.getImpersonatedSigner(sampleInput.userAddress);

    circuitWasmPath = './circuits/build/exampleMockDApp.wasm';
    circuitZkeyPath = './circuits/build/exampleMockDApp.zkey';

    // Deploy GuardianRegistry
    const GuardianRegistryFactory =
      await ethers.getContractFactory('GuardianRegistry');
    guardianRegistry = (await GuardianRegistryFactory.deploy(
      'https://example.com/metadata',
    )) as GuardianRegistry;
    await guardianRegistry.waitForDeployment();

    // Set GuardianRegistry in MockZkCertificateRegistry
    await mockZkCertificateRegistry.setGuardianRegistry(
      await guardianRegistry.getAddress(),
    );

    // Approve the provider's public key
    await guardianRegistry.grantGuardianRole(
      deployer.address,
      [zkKYC.providerData.ax, zkKYC.providerData.ay],
      'https://example.com/provider-metadata',
    );
  });

  it('if the proof is correct the verification SBT is minted', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    const publicRoot = publicSignals[Number(await ageProofZkKYC.INDEX_ROOT())];

    // set the merkle root to the correct one
    await mockZkCertificateRegistry.setMerkleRoot(
      fromHexToBytes32(fromDecToHex(publicRoot)),
    );

    const publicTime = parseInt(
      publicSignals[Number(await ageProofZkKYC.INDEX_CURRENT_TIME())],
      10,
    );

    // set the galactica institution pub key
    // set the institution pub keys
    const startIndex: number = Number(
      await ageProofZkKYC.START_INDEX_INVESTIGATION_INSTITUTIONS(),
    );
    for (let i = 0; i < amountInstitutions; i++) {
      const galacticaInstitutionPubKey: [BigNumberish, BigNumberish] = [
        publicSignals[startIndex + 2 * i],
        publicSignals[startIndex + 2 * i + 1],
      ];
      await mockGalacticaInstitutions[i].setInstitutionPubkey(
        galacticaInstitutionPubKey,
      );
    }

    // set time to the public time
    await hre.network.provider.send('evm_setNextBlockTimestamp', [publicTime]);
    await hre.network.provider.send('evm_mine');

    const [piA, piB, piC] = processProof(proof);

    const publicInputs = processPublicSignals(publicSignals);
    const humanID = publicInputs[Number(await ageProofZkKYC.INDEX_HUMAN_ID())];

    const previousUserBalance = await verificationSBT.balanceOf(user.address);

    // test that the transfer event is emitted
    const tokenId = await verificationSBT.getUsersTokenID(user.address);
    await expect(
      mockDApp.connect(user).airdropToken(1, piA, piB, piC, publicInputs),
    )
      .to.emit(verificationSBT, 'Transfer')
      .withArgs(
        '0x0000000000000000000000000000000000000000',
        user.address,
        tokenId,
      );

    expect(await verificationSBT.balanceOf(user.address)).to.be.equal(
      previousUserBalance + BigInt(1),
    );
    expect(await verificationSBT.tokenIdToOwner(tokenId)).to.be.equal(
      user.address,
    );
    expect(await verificationSBT.issuingDApp()).to.be.equal(
      await mockDApp.getAddress(),
    );

    // check that the verification SBT is created
    expect(
      await verificationSBT.isVerificationSBTValid(user.address),
    ).to.be.equal(true);
    // data is stored for the correct humanID
    expect(
      await mockDApp.hasReceivedToken1(fromHexToBytes32(fromDecToHex(humanID))),
    ).to.be.equal(true);

    // check the content of the verification SBT
    const verificationSBTInfo = await verificationSBT.getVerificationSBTInfo(
      user.address,
    );
    expect(verificationSBTInfo.verifierWrapper).to.be.equal(
      await ageProofZkKYC.getAddress(),
    );

    // check that the verificationSBT can be used to receive the second token without proof
    await mockDApp.connect(user).airdropToken(
      2,
      [0, 0],
      [
        [0, 0],
        [0, 0],
      ],
      [0, 0],
      publicInputs,
    );

    expect(
      await mockDApp.hasReceivedToken2(fromHexToBytes32(fromDecToHex(humanID))),
    ).to.be.true;

    // test decryption
    const userPriv = await getEddsaKeyFromEthSigner(encryptionAccount);

    const eddsa = await buildEddsa();
    const userPub = eddsa.prv2pub(userPriv);

    // let all institutions decrypt their shamir secret sharing part
    const decryptedData: any[][] = [];
    for (let i = 0; i < amountInstitutions; i++) {
      const galaInstitutionPriv = await getEddsaKeyFromEthSigner(
        institutions[i],
      );

      decryptedData[i] = await decryptFraudInvestigationData(
        galaInstitutionPriv,
        userPub,
        [
          verificationSBTInfo.encryptedData[2 * i],
          verificationSBTInfo.encryptedData[2 * i + 1],
        ],
      );
    }

    // test if the first two investigation institutions can decrypt the data (2 of 3 shamir secret sharing)
    const reconstructedSecret = reconstructShamirSecret(eddsa.F, 2, [
      [1, decryptedData[0][0]],
      [2, decryptedData[1][0]],
    ]);
    expect(
      reconstructedSecret,
      'Fraud investigation should be able to reconstruct the secret',
    ).to.be.equal(zkKYC.leafHash);
    // check that the verification SBT can be found by the frontend
    const loggedSBTs = await queryVerificationSBTs(
      [await verificationSBT.getAddress()],
      user.address,
    );
    expect(loggedSBTs.has(await verificationSBT.getAddress())).to.be.true;
    const address = await verificationSBT.getAddress();
    if (!address) {
      throw new Error('VerificationSBT address is undefined');
    }
    const loggedSBTsAddress = loggedSBTs.get(address);
    if (!loggedSBTsAddress) {
      throw new Error('VerificationSBT address is not found');
    }
    expect(loggedSBTsAddress.length).to.be.equal(1);

    // wait for SBT expiration
    const expirationTime = parseInt(
      publicSignals[
        Number(await ageProofZkKYC.INDEX_VERIFICATION_EXPIRATION())
      ],
      10,
    );
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      expirationTime + 1,
    ]);
    await hre.network.provider.send('evm_mine');

    // check that the verification SBT is not valid anymore
    expect(await verificationSBT.isVerificationSBTValid(user.address)).to.be
      .false;
    expect(await verificationSBT.balanceOf(user.address)).to.be.equal(0);

    // check that expired SBTs can still be found (e.g. for frontend purposes)
    expect(await verificationSBT.tokenURI(tokenId)).to.be.equal(
      'https://example.com/metadata',
    );
    expect(await verificationSBT.ownerOf(tokenId)).to.be.equal(user.address);
  });

  it('should revert on incorrect proof', async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      sampleInput,
      circuitWasmPath,
      circuitZkeyPath,
    );

    // change the proof to make it incorrect
    proof.pi_a[0] = `${JSON.stringify(proof.pi_a[0])}1`;

    const publicRoot = publicSignals[Number(await ageProofZkKYC.INDEX_ROOT())];
    const publicTime = parseInt(
      publicSignals[Number(await ageProofZkKYC.INDEX_CURRENT_TIME())],
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

    const tx = mockDApp
      .connect(user)
      .airdropToken(1, piA, piB, piC, publicInputs);

    await expect(tx).to.be.rejected;
  });
});
