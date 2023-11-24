/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { buildEddsa, poseidonContract } from 'circomlibjs';
import hre from 'hardhat';

import { deploySC } from '../../lib/hardhatHelpers';
import { overwriteArtifact } from '../../lib/helpers';
import { getEddsaKeyFromEthSigner } from '../../lib/keyManagement';

const { log } = console;

/**
 * Deploys the infrastructure for zkKYC.
 *
 * @param deployer - The deployer wallet.
 * @param institutions - The institutions wallets for fraud investigation.
 * @returns The deployed contracts.
 */
export async function deployInfrastructure(
  deployer: SignerWithAddress,
  institutions: SignerWithAddress[],
): Promise<{
  poseidonT3: any;
  guardianRegistry: any;
  recordRegistry: any;
  zkpVerifier: any;
  institutionContracts: any[];
  ageProofZkKYC: any;
  verificationSBT: any;
}> {
  log(`Using account ${deployer.address} to deploy contracts`);
  log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  log(
    `Using institutions ${JSON.stringify(
      institutions.map((i) => i.address),
    )} for fraud investigation`,
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
  for (const inst of institutions) {
    const galacticaInstitution = await deploySC(
      'MockGalacticaInstitution',
      true,
    );
    const institutionPrivKey = await getEddsaKeyFromEthSigner(inst);
    const eddsa = await buildEddsa();
    let institutionPub = eddsa.prv2pub(institutionPrivKey);
    // convert pubkey uint8array to decimal string
    const pubAsDecimalString = institutionPub.map((pubKey: Uint8Array) =>
      eddsa.poseidon.F.toObject(pubKey).toString(),
    );
    console.log('Institution pubkey: ', pubAsDecimalString);
    await galacticaInstitution.setInstitutionPubkey(pubAsDecimalString);
    institutionContracts.push(galacticaInstitution);
  }

  const ageProofZkKYC = await deploySC('AgeProofZkKYC', true, {}, [
    deployer.address,
    zkpVerifier.address,
    recordRegistry.address,
    institutionContracts.map((contract) => contract.address),
  ]);
  const verificationSBT = await deploySC('VerificationSBT', true);

  return {
    poseidonT3,
    guardianRegistry,
    recordRegistry,
    zkpVerifier,
    institutionContracts,
    ageProofZkKYC,
    verificationSBT,
  };
}
