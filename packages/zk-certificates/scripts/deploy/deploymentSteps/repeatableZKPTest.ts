/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { TokenData } from '@galactica-net/galactica-types';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';

import { deploySC, tryVerification } from '../../../lib/hardhatHelpers';

const { log } = console;

/**
 * Deploys the example DApp, a smart contract requiring zkKYC to issue a verification SBT, repeatably.
 * @param deployer - The deployer wallet.
 * @param zkKYCRegistryAddr - The address of the zkKYC registry.
 * @param sbtData - The data of the verification SBT.
 * @returns The deployed contracts.
 */
export async function deployRepeatableZKPTest(
  deployer: SignerWithAddress,
  zkKYCRegistryAddr: string,
  sbtData: TokenData,
): Promise<{
  zkKYCVerifier: any;
  zkKYCSC: any;
  repeatableZKPTest: any;
  sbtAddr: string;
}> {
  log(`Using account ${await deployer.getAddress()} to deploy contracts`);
  log(
    `Account balance: ${(
      await ethers.provider.getBalance(deployer)
    ).toString()}`,
  );

  // deploying everything
  const zkKYCVerifier = await deploySC('ZkKYCVerifier', true);
  const zkKYCSC = await deploySC('ZkKYC', true, {}, [
    await deployer.getAddress(),
    await zkKYCVerifier.getAddress(),
    zkKYCRegistryAddr,
    [],
  ]);
  const repeatableZKPTest = await deploySC('RepeatableZKPTest', true, {}, [
    await zkKYCSC.getAddress(),
    sbtData.uri,
    sbtData.name,
    sbtData.symbol,
  ]);

  const sbtAddr = await repeatableZKPTest.sbt();
  await tryVerification(
    sbtAddr,
    [
      sbtData.uri,
      sbtData.name,
      sbtData.symbol,
      await repeatableZKPTest.getAddress(),
    ],
    'contracts/SBT_related/VerificationSBT.sol:VerificationSBT',
  );

  return {
    zkKYCVerifier,
    zkKYCSC,
    repeatableZKPTest,
    sbtAddr,
  };
}
