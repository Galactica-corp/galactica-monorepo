/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { deploySC } from '../../lib/hardhatHelpers';

const { log } = console;

/**
 * Deploys the example DApp, a smart contract requiring zkKYC to issue a verification SBT, repeatably.
 * @param deployer - The deployer wallet.
 * @param verificationSBTAddr - The address of the verification SBT.
 * @param zkKYCRegistryAddr - The address of the zkKYC registry.
 * @returns The deployed contracts.
 */
export async function deployRepeatableZKPTest(
  deployer: SignerWithAddress,
  verificationSBTAddr: string,
  zkKYCRegistryAddr: string,
): Promise<{
  zkKYCVerifier: any;
  zkKYCSC: any;
  repeatableZKPTest: any;
}> {
  log(`Using account ${deployer.address} to deploy contracts`);
  log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  // deploying everything
  const zkKYCVerifier = await deploySC('ZkKYCVerifier', true);
  const zkKYCSC = await deploySC('ZkKYC', true, {}, [
    deployer.address,
    zkKYCVerifier.address,
    zkKYCRegistryAddr,
    [],
  ]);
  const repeatableZKPTest = await deploySC('RepeatableZKPTest', true, {}, [
    verificationSBTAddr,
    zkKYCSC.address,
  ]);

  return {
    zkKYCVerifier,
    zkKYCSC,
    repeatableZKPTest,
  };
}
