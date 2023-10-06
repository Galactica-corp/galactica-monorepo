/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { buildEddsa, poseidonContract } from 'circomlibjs';
import hre from 'hardhat';

import { deploySC } from '../lib/hardhatHelpers';
import { overwriteArtifact } from '../lib/helpers';
import { getEddsaKeyFromEthSigner } from '../lib/keyManagement';

const { log } = console;

/**
 * Script to deploy the infrastructure for zkKYC.
 * Including:
 * - PoseidonT3 hash function
 * - GuardianRegistry
 * - KYCRecordRegistry
 * - ExampleMockDAppVerifier
 * - 3 example institutions for fraud investigation
 * - AgeProofZkKYC
 * - VerificationSBT.
 */
async function main() {
  // wallets
  const [deployer, institution1, institution2, institution3] =
    await hre.ethers.getSigners();

  log(`Using account ${deployer.address} to deploy contracts`);
  log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  log(
    `Using account ${institution1.address} as institution for fraud investigation`,
  );

  // get poseidon from library
  await overwriteArtifact(hre, 'PoseidonT3', poseidonContract.createCode(2));

  // deploying everything
  const poseidonT3 = await deploySC('PoseidonT3', false);
  const guardianRegistry = await deploySC('GuardianRegistry', true);
  const recordRegistry = await deploySC(
    'KYCRecordRegistryTest',
    true,
    {
      libraries: {
        PoseidonT3: poseidonT3.address,
      },
    },
    [guardianRegistry.address],
  );
  const zkpVerifier = await deploySC('ExampleMockDAppVerifier', true);

  const institutionContracts = [];
  for (const inst of [institution1, institution2, institution3]) {
    const galacticaInstitution = await deploySC(
      'MockGalacticaInstitution',
      true,
    );
    const institutionPrivKey = BigInt(
      await getEddsaKeyFromEthSigner(inst),
    ).toString();
    const eddsa = await buildEddsa();
    let institutionPub = eddsa.prv2pub(institutionPrivKey);
    // convert pubkey uint8array to decimal string
    institutionPub = institutionPub.map((pubKey: Uint8Array) =>
      eddsa.poseidon.F.toObject(pubKey).toString(),
    );
    console.log('Institution pubkey: ', institutionPub);
    await galacticaInstitution.setInstitutionPubkey(institutionPub);
    institutionContracts.push(galacticaInstitution);
  }

  await deploySC('AgeProofZkKYC', true, {}, [
    deployer.address,
    zkpVerifier.address,
    recordRegistry.address,
    institutionContracts.map((contract) => contract.address),
  ]);
  await deploySC('VerificationSBT', true);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
