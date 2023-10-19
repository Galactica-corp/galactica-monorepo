/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import hre from 'hardhat';

import { deploySC } from '../../lib/hardhatHelpers';

const { log } = console;

/**
 * Deploys a simple contract that everyone can use to test issuing zkKYCs without having to be whitelisted as guardians first.
 * Meant for the devnet.
 *
 * @param deployer - The deployer wallet.
 * @param guardianRegistryAddr - The address of the guardian registry.
 * @param zkCertRegistryAddr - The address of the zkCert registry.
 * @returns The deployed devnet guardian.
 */
export async function deployDevnetGuardian(
  deployer: SignerWithAddress,
  guardianRegistryAddr: string,
  zkCertRegistryAddr: string,
): Promise<Contract> {
  log(`Using account ${deployer.address} to deploy contracts`);
  log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  // deploying everything
  const devnetGuardian = await deploySC('DevnetGuardian', true, {}, [
    zkCertRegistryAddr,
  ]);
  log(`DevnetGuardian deployed to: ${devnetGuardian.address}`);

  const guardianRegistry = await hre.ethers.getContractAt(
    'GuardianRegistry',
    guardianRegistryAddr,
  );
  const pubkey = [0, 0]; // the devnet guardian has no unique EdDSA pubkey because it is meant to be a proxy for testing
  await guardianRegistry.grantGuardianRole(
    devnetGuardian.address,
    pubkey,
    'DevnetGuardianProxy',
  );
  log(`DevnetGuardian whitelisted as KYC Guardian in GuardianRegistry`);

  return devnetGuardian;
}
