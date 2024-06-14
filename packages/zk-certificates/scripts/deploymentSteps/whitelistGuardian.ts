/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { buildEddsa } from 'circomlibjs';
import { ethers } from 'hardhat';

import { getEddsaKeyFromEthSigner } from '../../lib/keyManagement';

/**
 * Whitelists a guardian in the guardian registry.
 * @param authorizer - The signer to submit the whitelist tx.
 * @param guardianRegistryAddr - The address of the guardian registry.
 * @param guardian - The signer of the guardian to whitelist (needed to generate EdDSA keys).
 * @param guardianName - The name of the guardian.
 */
export async function whitelistGuardian(
  authorizer: SignerWithAddress,
  guardianRegistryAddr: string,
  guardian: SignerWithAddress,
  guardianName: string,
) {
  console.log(`Using account ${authorizer.address} for controlling whitelist`);
  console.log(`Account balance: ${(await authorizer.provider.getBalance(authorizer.address)).toString()}`);
  console.log();

  const guardianAddr = guardian.address;
  // get pubkey of guardian, if we have the private key, we can derive it here, otherwise just enter the pubkey
  const eddsa = await buildEddsa();
  const privKey = await getEddsaKeyFromEthSigner(guardian);
  const guardianPubKey = eddsa
    .prv2pub(privKey)
    .map((component: any) => eddsa.poseidon.F.toObject(component).toString());

  console.log(
    `Whitelisting guardian ${guardian.address
    } with name ${guardianName} and pubkey ${JSON.stringify(guardianPubKey)}`,
  );

  // get contract
  const guardianRegistry = await ethers.getContractAt(
    'GuardianRegistry',
    guardianRegistryAddr,
  );

  console.log(`Adding ${guardianAddr} as guardian...`);
  const tx = await guardianRegistry.grantGuardianRole(
    guardian.address,
    guardianPubKey,
    guardianName,
  );
  await tx.wait();

  console.log(`Done`);
}
