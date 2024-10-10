/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { buildPoseidon } from 'circomlibjs';

import { deploySC } from '../../lib/hardhatHelpers';
import { hashStringToFieldNumber } from '../../lib/helpers';
import type { Poseidon } from '../../lib/poseidon';

const { log } = console;

type ComplianceContracts = {
  ageCitizenshipKYC: any;
  dApp: any;
};

/**
 * Deploys the standard KYC compliance proofs used in the Galactica Passport.
 * @param deployer - The deployer wallet.
 * @param recordRegistryAddr - The address of the ZkKYC record registry.
 * @param verificationSBTAddr - The address of the verification SBT.
 * @returns The deployed contracts.
 */
export async function deployKYCComplianceProofsDApps(
  deployer: SignerWithAddress,
  recordRegistryAddr: string,
  verificationSBTAddr: string,
): Promise<{
  zkpVerifier: any;
  nonUS: ComplianceContracts;
  nonSanctionedJurisdiction: ComplianceContracts;
  adult18Plus: ComplianceContracts;
}> {
  log(`Using account ${deployer.address} to deploy contracts`);
  log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  const poseidon = (await buildPoseidon()) as Poseidon;

  // common circom ZKP verifier
  const zkpVerifier = await deploySC('AgeCitizenshipKYCVerifier', true);

  log('NonUS:');
  const nonUS: ComplianceContracts = {
    ageCitizenshipKYC: await deploySC('AgeCitizenshipKYC', true, {}, [
      deployer.address,
      zkpVerifier.address,
      recordRegistryAddr,
      // sanctioned countries: undefined ("1") + hash of USA + placeholders
      ['1', hashStringToFieldNumber('USA', poseidon)].concat(
        Array(18).fill('0'),
      ),
      // no investigation institutions
      [],
      0, // no age threshold
    ]),
    basicExampleDApp: undefined,
  };
  nonUS.dApp = await deploySC('NonUSProverDApp', true, {}, [
    verificationSBTAddr,
    nonUS.ageCitizenshipKYC.address,
  ]);

  log('NonSanctionedJurisdiction:');
  const nonSanctionedJurisdiction: ComplianceContracts = {
    ageCitizenshipKYC: await deploySC('AgeCitizenshipKYC', true, {}, [
      deployer.address,
      zkpVerifier.address,
      recordRegistryAddr,
      // sanctioned countries: undefined ("1") + hash of sanctioned countries + placeholders
      [
        '1',
        hashStringToFieldNumber('RUS', poseidon),
        hashStringToFieldNumber('BLR', poseidon),
        hashStringToFieldNumber('IRN', poseidon),
        hashStringToFieldNumber('PRK', poseidon),
        hashStringToFieldNumber('SYR', poseidon),
        hashStringToFieldNumber('VEN', poseidon),
        hashStringToFieldNumber('CUB', poseidon),
        hashStringToFieldNumber('MMR', poseidon),
        hashStringToFieldNumber('LBY', poseidon),
        hashStringToFieldNumber('SDN', poseidon),
        hashStringToFieldNumber('SSD', poseidon),
        hashStringToFieldNumber('YEM', poseidon),
        hashStringToFieldNumber('SOM', poseidon),
        hashStringToFieldNumber('COD', poseidon),
        hashStringToFieldNumber('CAF', poseidon),
      ].concat(Array(4).fill('0')),
      // no investigation institutions
      [],
      0, // no age threshold
    ]),
    basicExampleDApp: undefined,
  };
  nonSanctionedJurisdiction.dApp = await deploySC(
    'NonSanctionedProverDApp',
    true,
    {},
    [verificationSBTAddr, nonSanctionedJurisdiction.ageCitizenshipKYC.address],
  );

  log('Adult18Plus:');
  const adult18Plus: ComplianceContracts = {
    ageCitizenshipKYC: await deploySC('AgeCitizenshipKYC', true, {}, [
      deployer.address,
      zkpVerifier.address,
      recordRegistryAddr,
      // sanctioned countries: undefined ("1") + hash of USA + placeholders
      ['1'].concat(Array(19).fill('0')),
      // no investigation institutions
      [],
      18, // no age threshold
    ]),
    basicExampleDApp: undefined,
  };
  adult18Plus.dApp = await deploySC(
    'Age18ProverDApp',
    true,
    {},
    [verificationSBTAddr, adult18Plus.ageCitizenshipKYC.address],
  );

  return {
    zkpVerifier,
    nonUS,
    nonSanctionedJurisdiction,
    adult18Plus,
  };
}
