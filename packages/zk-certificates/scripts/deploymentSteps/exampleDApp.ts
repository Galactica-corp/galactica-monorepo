/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { deploySC } from '../../lib/hardhatHelpers';

const { log } = console;

/**
 * Deploys the example DApp, a smart contract requiring zkKYC + age proof to airdrop tokens once to each user.
 * @param deployer - The deployer wallet.
 * @param verificationSBTAddr - The address of the verification SBT.
 * @param ageCitizenshipKYCAddr - The address of the age proof zkKYC.
 * @returns The deployed contracts.
 */
export async function deployExampleDApp(
  deployer: SignerWithAddress,
  verificationSBTAddr: string,
  ageCitizenshipKYCAddr: string,
): Promise<{
  mockDApp: any;
  token1: any;
  token2: any;
}> {
  log(`Using account ${deployer.address} to deploy contracts`);
  log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  // deploying everything
  const mockDApp = await deploySC('MockDApp', true, {}, [
    verificationSBTAddr,
    ageCitizenshipKYCAddr,
  ]);
  const token1 = await deploySC(
    'contracts/mock/MockToken.sol:MockToken',
    true,
    {},
    [mockDApp.address],
  );
  const token2 = await deploySC(
    'contracts/mock/MockToken.sol:MockToken',
    true,
    {},
    [mockDApp.address],
  );

  await mockDApp.setToken1(token1.address);
  await mockDApp.setToken2(token2.address);

  return {
    mockDApp,
    token1,
    token2,
  };
}
