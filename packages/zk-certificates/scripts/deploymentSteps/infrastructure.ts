/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { buildEddsa, poseidonContract } from 'circomlibjs';
import hre from 'hardhat';

import { deploySC } from '../../lib/hardhatHelpers';
import { overwriteArtifact } from '../../lib/helpers';
import { getEddsaKeyFromEthSigner } from '../../lib/keyManagement';

const { log } = console;

/**
 * Deploys the infrastructure for zkKYC.
 * @param deployer - The deployer wallet.
 * @param institutions - The institutions wallets for fraud investigation.
 * @param merkleTreeDepth - The depth of the Registration merkle tree.
 * @returns The deployed contracts.
 */
export async function deployInfrastructure(
  deployer: SignerWithAddress,
  institutions: SignerWithAddress[],
  merkleTreeDepth = 32,
): Promise<{
  poseidonT3: any;
  guardianRegistry: any;
  recordRegistry: any;
  zkpVerifier: any;
  institutionContracts: any[];
  ageProofZkKYC: any;
  verificationSBT: any;
}> {
  log(`Using account ${await deployer.getAddress()} to deploy contracts`);
  log(`Account balance: ${(await deployer.provider.getBalance(await deployer.getAddress())).toString()}`);

  log(
    `Using institutions ${JSON.stringify(
      await institutions.map(async (i) => await i.getAddress()),
    )} for fraud investigation`,
  );

  // get poseidon from library
  await overwriteArtifact(hre, 'PoseidonT3', poseidonContract.createCode(2));

  // deploying everything
  const poseidonT3 = await deploySC('PoseidonT3', false);
  const guardianRegistry = await deploySC('GuardianRegistry', true, {}, [
    'ZkKYC GuardianRegistry',
  ]);
  const recordRegistry = await deploySC(
    'ZkCertificateRegistryTest',
    true,
    {
      libraries: {
        PoseidonT3: await poseidonT3.getAddress(),
      },
    },
    [await guardianRegistry.getAddress(), merkleTreeDepth],
  );

  const queueExpirationTime = 60 * 5;
  console.log(
    `Changing queue expiration time to ${queueExpirationTime} seconds.`,
  );
  await recordRegistry.changeQueueExpirationTime(queueExpirationTime);

  const zkpVerifier = await deploySC('ExampleMockDAppVerifier', true);

  const institutionContracts = [];
  for (const inst of institutions) {
    const galacticaInstitution = await deploySC(
      'MockGalacticaInstitution',
      true,
    );
    const institutionPrivKey = await getEddsaKeyFromEthSigner(inst);
    const eddsa = await buildEddsa();
    const institutionPub = eddsa.prv2pub(institutionPrivKey);
    // convert pubkey uint8array to decimal string
    const pubAsDecimalString = institutionPub.map((pubKey: Uint8Array) =>
      eddsa.poseidon.F.toObject(pubKey).toString(),
    );
    console.log('Institution pubkey: ', pubAsDecimalString);
    await galacticaInstitution.setInstitutionPubkey(pubAsDecimalString);
    institutionContracts.push(galacticaInstitution);
  }

  const ageProofZkKYC = await deploySC('AgeProofZkKYC', true, {}, [
    await deployer.getAddress(),
    await zkpVerifier.getAddress(),
    await recordRegistry.getAddress(),
    await institutionContracts.map(async (contract) => await contract.getAddress()),
  ]);
  const verificationSBT = await deploySC('VerificationSBT', true, {}, [
    'https://quicknode.quicknode-ipfs.com/ipfs/QmNiiVqLKE9WxUegeWoKBtVVaPaA44sQBcrTCPnHt6Kecs',
  ]);

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
