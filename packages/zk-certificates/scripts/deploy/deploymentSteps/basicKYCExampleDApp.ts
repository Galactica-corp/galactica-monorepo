/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { TokenData } from '@galactica-net/galactica-types';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import type { Contract } from 'ethers';
import { ethers } from 'hardhat';

import { deploySC, tryVerification } from '../../../lib/hardhatHelpers';

const { log } = console;

/**
 * Deploy the example DApp, a smart contract requiring zkKYC to issue a verification SBT.
 * @param deployer - The deployer wallet.
 * @param zkKYCAddr - The address of the zkKYC.
 * @param sbtData - The data of the verification SBT.
 * @returns The deployed contract.
 */
export async function deployBasicKYCExampleDApp(
  deployer: SignerWithAddress,
  zkKYCAddr: string,
  sbtData: TokenData,
): Promise<{
  dApp: Contract;
  sbtAddr: string;
}> {
  log(`Using account ${await deployer.getAddress()} to deploy contracts`);
  log(
    `Account balance: ${(
      await ethers.provider.getBalance(deployer)
    ).toString()}`,
  );

  // deploying everything
  const dApp = await deploySC(
    'contracts/dapps/BasicKYCExampleDApp.sol:BasicKYCExampleDApp',
    true,
    {},
    [zkKYCAddr, sbtData.uri, sbtData.name, sbtData.symbol],
  );

  const sbtAddr = await dApp.sbt();

  await tryVerification(
    sbtAddr,
    [sbtData.uri, sbtData.name, sbtData.symbol, await dApp.getAddress()],
    'contracts/SBT_related/VerificationSBT.sol:VerificationSBT',
  );

  return { dApp, sbtAddr };
}
