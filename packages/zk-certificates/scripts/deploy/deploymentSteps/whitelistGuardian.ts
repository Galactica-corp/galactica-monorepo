/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { buildEddsa } from 'circomlibjs';
import { ethers } from 'hardhat';

import { getEddsaKeyFromEthSigner } from '../../../lib/keyManagement';

/**
 * Whitelists a guardian in the guardian registry.
 * @param authorizer - The signer to submit the whitelist tx.
 * @param guardianRegistryAddr - The address of the guardian registry.
 * @param guardian - The signer of the guardian to whitelist (needed to generate EdDSA keys).
 * @param metadataURL - The URL of the guardian metadata, see https://github.com/Galactica-corp/Documentation/blob/master/kyc-guardian-guide/create-and-issue-zkkyc.md for schema.
 */
export async function whitelistSignerGuardian(
  authorizer: SignerWithAddress,
  guardianRegistryAddr: string,
  guardian: SignerWithAddress,
  metadataURL: string,
) {
  // get pubkey of guardian, if we have the private key, we can derive it here, otherwise just enter the pubkey
  const eddsa = await buildEddsa();
  const privKey = await getEddsaKeyFromEthSigner(guardian);
  const guardianPubKey = eddsa
    .prv2pub(privKey)
    .map((component: any) => eddsa.poseidon.F.toObject(component).toString());

  await whitelistGuardian(
    authorizer,
    guardianRegistryAddr,
    await guardian.getAddress(),
    guardianPubKey as [string, string],
    metadataURL,
  );
}

/**
 * Whitelists a guardian in the guardian registry.
 * @param authorizer - The signer to submit the whitelist tx.
 * @param guardianRegistryAddr - The address of the guardian registry.
 * @param guardianAddress - The address of the guardian to whitelist.
 * @param guardianPubKey - The EdDSA public key of the guardian to whitelist.
 * @param metadataURL - The URL of the guardian metadata, see https://github.com/Galactica-corp/Documentation/blob/master/kyc-guardian-guide/create-and-issue-zkkyc.md for schema.
 */
export async function whitelistGuardian(
  authorizer: SignerWithAddress,
  guardianRegistryAddr: string,
  guardianAddress: string,
  guardianPubKey: [string, string],
  metadataURL: string,
) {
  console.log(
    `Using account ${await authorizer.getAddress()} for controlling whitelist`,
  );
  console.log(
    `Account balance: ${(
      await ethers.provider.getBalance(authorizer)
    ).toString()}`,
  );
  console.log();

  console.log(
    `Whitelisting guardian ${guardianAddress} with pubkey ${JSON.stringify(
      guardianPubKey,
    )} and metadata ${metadataURL}`,
  );

  // get contract
  const guardianRegistry = await ethers.getContractAt(
    'GuardianRegistry',
    guardianRegistryAddr,
  );

  console.log(`Adding ${guardianAddress} as guardian...`);
  const tx = await guardianRegistry.grantGuardianRole(
    guardianAddress,
    guardianPubKey,
    metadataURL,
  );
  await tx.wait();

  console.log(`Done`);
}
