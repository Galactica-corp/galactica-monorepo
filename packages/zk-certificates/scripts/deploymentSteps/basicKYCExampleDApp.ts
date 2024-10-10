/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { deploySC } from '../../lib/hardhatHelpers';

const { log } = console;

/**
 * Deploy the example DApp, a smart contract requiring zkKYC to issue a verification SBT.
 * @param deployer - The deployer wallet.
 * @param verificationSBTAddr - The address of the verification SBT.
 * @param zkKYCAddr - The address of the zkKYC.
 * @returns The deployed contract.
 */
export async function deployBasicKYCExampleDApp(
  deployer: SignerWithAddress,
  verificationSBTAddr: string,
  zkKYCAddr: string,
): Promise<any> {
  log(`Using account ${deployer.address} to deploy contracts`);
  log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  // deploying everything
  return await deploySC(
    'contracts/dapps/BasicKYCExampleDApp.sol:BasicKYCExampleDApp',
    true,
    {},
    [verificationSBTAddr, zkKYCAddr],
  );
}
