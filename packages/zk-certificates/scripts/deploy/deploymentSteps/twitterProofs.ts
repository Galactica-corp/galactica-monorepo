/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { TokenData } from '@galactica-net/galactica-types';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';

import { deploySC } from '../../../lib/hardhatHelpers';

const { log } = console;

type TwitterContracts = {
  creationTimeProof: {
    verifier: any;
    wrapper: any;
    sbtBefore2020Addr: string;
    sbtIn2024Addr: string;
  };
  followersCountProof: {
    verifier: any;
    wrapper: any;
    sbt100Addr: string;
    sbt1kAddr: string;
    sbt10kAddr: string;
  };
  dAppSBTManager: any;
};

/**
 * Deploys the standard Twitter proofs used in the Galactica Passport.
 * @param deployer - The deployer wallet.
 * @param recordRegistryAddr - The address of the Twitter record registry.
 * @param sbtCreationTimeBefore2020 - The data of the CreationTime SBT.
 * @param sbtCreationTimeIn2024 - The data of the CreationTime SBT.
 * @param sbtFollowersCount100 - The data of the FollowersCount SBT.
 * @param sbtFollowersCount1k - The data of the FollowersCount SBT.
 * @param sbtFollowersCount10k - The data of the FollowersCount SBT.
 * @returns The deployed contracts.
 */
export async function deployTwitterProofs(
  deployer: SignerWithAddress,
  recordRegistryAddr: string,
  sbtCreationTimeBefore2020: TokenData,
  sbtCreationTimeIn2024: TokenData,
  sbtFollowersCount100: TokenData,
  sbtFollowersCount1k: TokenData,
  sbtFollowersCount10k: TokenData,
): Promise<TwitterContracts> {
  log(`Using account ${await deployer.getAddress()} to deploy contracts`);
  log(
    `Account balance: ${(
      await ethers.provider.getBalance(deployer)
    ).toString()}`,
  );

  // Deploy common SBTManager for Twitter proofs
  const dAppSBTManager = await deploySC('SBTManager', true, {}, [
    await deployer.getAddress(),
  ]);

  log('FollowersCount:');
  const zkpVerifierFollowersCount = await deploySC(
    'TwitterFollowersCountProofVerifier',
    true,
  );

  const followersCountWrapper = await deploySC(
    'TwitterFollowersCountProof',
    true,
    {},
    [
      await deployer.getAddress(),
      await zkpVerifierFollowersCount.getAddress(),
      recordRegistryAddr,
    ],
  );

  // Deploy SBT for Twitter followers count proof
  const followersCountSBT100 = await deploySC('VerificationSBT', true, {}, [
    sbtFollowersCount100.uri,
    sbtFollowersCount100.name,
    sbtFollowersCount100.symbol,
    await dAppSBTManager.getAddress(),
  ]);
  const followersCountSBT1k = await deploySC('VerificationSBT', true, {}, [
    sbtFollowersCount1k.uri,
    sbtFollowersCount1k.name,
    sbtFollowersCount1k.symbol,
    await dAppSBTManager.getAddress(),
  ]);
  const followersCountSBT10k = await deploySC('VerificationSBT', true, {}, [
    sbtFollowersCount10k.uri,
    sbtFollowersCount10k.name,
    sbtFollowersCount10k.symbol,
    await dAppSBTManager.getAddress(),
  ]);

  await dAppSBTManager.setSBT(0, await followersCountSBT100.getAddress());
  await dAppSBTManager.setVerifierWrapper(
    0,
    await followersCountWrapper.getAddress(),
  );
  await dAppSBTManager.setSBT(1, await followersCountSBT1k.getAddress());
  await dAppSBTManager.setVerifierWrapper(
    1,
    await followersCountWrapper.getAddress(),
  );
  await dAppSBTManager.setSBT(2, await followersCountSBT10k.getAddress());
  await dAppSBTManager.setVerifierWrapper(
    2,
    await followersCountWrapper.getAddress(),
  );

  log('CreationTime:');
  const zkpVerifierCreationTime = await deploySC(
    'TwitterCreationTimeProofVerifier',
    true,
  );

  const creationTimeWrapper = await deploySC(
    'TwitterCreationTimeProof',
    true,
    {},
    [
      await deployer.getAddress(),
      await zkpVerifierCreationTime.getAddress(),
      recordRegistryAddr,
    ],
  );

  const creationTimeSBTBefore2020 = await deploySC(
    'VerificationSBT',
    true,
    {},
    [
      sbtCreationTimeBefore2020.uri,
      sbtCreationTimeBefore2020.name,
      sbtCreationTimeBefore2020.symbol,
      await dAppSBTManager.getAddress(),
    ],
  );
  const creationTimeSBTIn2024 = await deploySC('VerificationSBT', true, {}, [
    sbtCreationTimeIn2024.uri,
    sbtCreationTimeIn2024.name,
    sbtCreationTimeIn2024.symbol,
    await dAppSBTManager.getAddress(),
  ]);

  // Set SBT and verifier wrapper in SBTManager
  await dAppSBTManager.setSBT(3, await creationTimeSBTBefore2020.getAddress());
  await dAppSBTManager.setVerifierWrapper(
    3,
    await creationTimeWrapper.getAddress(),
  );
  await dAppSBTManager.setSBT(4, await creationTimeSBTIn2024.getAddress());
  await dAppSBTManager.setVerifierWrapper(
    4,
    await creationTimeWrapper.getAddress(),
  );

  return {
    dAppSBTManager,
    creationTimeProof: {
      verifier: zkpVerifierCreationTime,
      wrapper: creationTimeWrapper,
      sbtBefore2020Addr: await creationTimeSBTBefore2020.getAddress(),
      sbtIn2024Addr: await creationTimeSBTIn2024.getAddress(),
    },
    followersCountProof: {
      verifier: zkpVerifierFollowersCount,
      wrapper: followersCountWrapper,
      sbt100Addr: await followersCountSBT100.getAddress(),
      sbt1kAddr: await followersCountSBT1k.getAddress(),
      sbt10kAddr: await followersCountSBT10k.getAddress(),
    },
  };
}
