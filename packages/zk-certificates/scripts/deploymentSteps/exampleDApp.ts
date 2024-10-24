/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { TokenData } from '@galactica-net/galactica-types';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { deploySC, tryVerification } from '../../lib/hardhatHelpers';

const { log } = console;

/**
 * Deploys the example DApp, a smart contract requiring zkKYC + age proof to airdrop tokens once to each user.
 * @param deployer - The deployer wallet.
 * @param recordRegistryAddr - The address of the zkKYC record registry.
 * @param institutionAddrs - The list of fraud investigation institutions.
 * @param sbtData - The data of the verification SBT.
 * @returns The deployed contracts.
 */
export async function deployExampleDApp(
  deployer: SignerWithAddress,
  recordRegistryAddr: string,
  institutionAddrs: string[],
  sbtData: TokenData,
): Promise<{
  zkpVerifier: any;
  ageCitizenshipKYC: any;
  mockDApp: any;
  token1: any;
  token2: any;
  sbtAddr: string;
}> {
  log(`Using account ${deployer.address} to deploy contracts`);
  log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  // deploying everything
  const zkpVerifier = await deploySC('AgeCitizenshipKYCVerifier', true);

  const ageCitizenshipKYC = await deploySC('AgeCitizenshipKYC', true, {}, [
    deployer.address,
    zkpVerifier.address,
    recordRegistryAddr,
    [], // no sanctioned countries
    institutionAddrs,
    0, // no age threshold
  ]);

  const mockDApp = await deploySC('MockDApp', true, {}, [
    ageCitizenshipKYC.address,
    sbtData.uri,
    sbtData.name,
    sbtData.symbol,
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

  const sbtAddr = await mockDApp.sbt();

  await tryVerification(
    sbtAddr,
    [sbtData.uri, sbtData.name, sbtData.symbol, mockDApp.address],
    'contracts/SBT_related/VerificationSBT.sol:VerificationSBT',
  );

  return {
    zkpVerifier,
    ageCitizenshipKYC,
    mockDApp,
    token1,
    token2,
    sbtAddr,
  };
}
