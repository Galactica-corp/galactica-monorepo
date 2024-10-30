/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { TokenData } from '@galactica-net/galactica-types';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { buildPoseidon } from 'circomlibjs';

import { deploySC, tryVerification } from '../../lib/hardhatHelpers';
import { hashStringToFieldNumber } from '../../lib/helpers';
import type { Poseidon } from '../../lib/poseidon';

const { log } = console;

type ComplianceContracts = {
  ageCitizenshipKYC: any;
  dApp: any;
  sbtAddr: string;
};

/**
 * Deploys the standard KYC compliance proofs used in the Galactica Passport.
 * @param deployer - The deployer wallet.
 * @param recordRegistryAddr - The address of the ZkKYC record registry.
 * @param sbtDataNonUS - The data of the NonUS SBT.
 * @param sbtDataNonSanctionedJurisdiction - The data of the NonSanctionedJurisdiction SBT.
 * @param sbtDataAdult18Plus - The data of the Adult18Plus SBT.
 * @returns The deployed contracts.
 */
export async function deployKYCComplianceProofsDApps(
  deployer: SignerWithAddress,
  recordRegistryAddr: string,
  sbtDataNonUS: TokenData,
  sbtDataNonSanctionedJurisdiction: TokenData,
  sbtDataAdult18Plus: TokenData,
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
  const nonUSWrapper = await deploySC('AgeCitizenshipKYC', true, {}, [
    deployer.address,
    zkpVerifier.address,
    recordRegistryAddr,
    // sanctioned countries: undefined ("1") + hash of USA + placeholders
    ['1', hashStringToFieldNumber('USA', poseidon)].concat(Array(18).fill('0')),
    // no investigation institutions
    [],
    0, // no age threshold
  ]);
  const nonUSDApp = await deploySC(
    'contracts/dapps/NonUSProverDApp.sol:NonUSProverDApp',
    true,
    {},
    [
      nonUSWrapper.address,
      sbtDataNonUS.uri,
      sbtDataNonUS.name,
      sbtDataNonUS.symbol,
    ],
  );
  const nonUSSBTAddr = await nonUSDApp.sbt();
  await tryVerification(
    nonUSSBTAddr,
    [
      sbtDataNonUS.uri,
      sbtDataNonUS.name,
      sbtDataNonUS.symbol,
      nonUSDApp.address,
    ],
    'contracts/SBT_related/VerificationSBT.sol:VerificationSBT',
  );

  log('NonSanctionedJurisdiction:');
  const nonSanctionedJurisdictionWrapper = await deploySC(
    'AgeCitizenshipKYC',
    true,
    {},
    [
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
    ],
  );
  const nonSanctionedJurisdictionDApp = await deploySC(
    'contracts/dapps/NonSanctionedProverDApp.sol:NonSanctionedProverDApp',
    true,
    {},
    [
      nonSanctionedJurisdictionWrapper.address,
      sbtDataNonSanctionedJurisdiction.uri,
      sbtDataNonSanctionedJurisdiction.name,
      sbtDataNonSanctionedJurisdiction.symbol,
    ],
  );
  const nonSanctionedJurisdictionSBTAddr =
    await nonSanctionedJurisdictionDApp.sbt();
  await tryVerification(
    nonSanctionedJurisdictionSBTAddr,
    [
      sbtDataNonSanctionedJurisdiction.uri,
      sbtDataNonSanctionedJurisdiction.name,
      sbtDataNonSanctionedJurisdiction.symbol,
      nonSanctionedJurisdictionDApp.address,
    ],
    'contracts/SBT_related/VerificationSBT.sol:VerificationSBT',
  );

  log('Adult18Plus:');
  const adult18PlusWrapper = await deploySC('AgeCitizenshipKYC', true, {}, [
    deployer.address,
    zkpVerifier.address,
    recordRegistryAddr,
    // sanctioned countries: undefined ("1") + hash of USA + placeholders
    ['1'].concat(Array(19).fill('0')),
    // no investigation institutions
    [],
    18, // no age threshold
  ]);
  const adult18PlusDApp = await deploySC(
    'contracts/dapps/Age18ProverDApp.sol:Age18ProverDApp',
    true,
    {},
    [
      adult18PlusWrapper.address,
      sbtDataAdult18Plus.uri,
      sbtDataAdult18Plus.name,
      sbtDataAdult18Plus.symbol,
    ],
  );
  const adult18PlusSBTAddr = await adult18PlusDApp.sbt();
  await tryVerification(
    adult18PlusSBTAddr,
    [
      sbtDataAdult18Plus.uri,
      sbtDataAdult18Plus.name,
      sbtDataAdult18Plus.symbol,
      adult18PlusDApp.address,
    ],
    'contracts/SBT_related/VerificationSBT.sol:VerificationSBT',
  );

  return {
    zkpVerifier,
    nonUS: {
      ageCitizenshipKYC: nonUSWrapper,
      dApp: nonUSDApp,
      sbtAddr: nonUSSBTAddr,
    },
    nonSanctionedJurisdiction: {
      ageCitizenshipKYC: nonSanctionedJurisdictionWrapper,
      dApp: nonSanctionedJurisdictionDApp,
      sbtAddr: nonSanctionedJurisdictionSBTAddr,
    },
    adult18Plus: {
      ageCitizenshipKYC: adult18PlusWrapper,
      dApp: adult18PlusDApp,
      sbtAddr: adult18PlusSBTAddr,
    },
  };
}
