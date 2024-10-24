/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { TokenData } from '@galactica-net/galactica-types';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { buildPoseidon } from 'circomlibjs';
import { parseEther } from 'ethers/lib/utils';

import { deploySC, tryVerification } from '../../lib/hardhatHelpers';
import { hashStringToFieldNumber } from '../../lib/helpers';
import type { Poseidon } from '../../lib/poseidon';

const { log } = console;

/**
 * Deploys the KYC requirement demo, a smart contract requiring zkKYC + age proof + citizenship sanctioned to mint an SBT for the user.
 * @param deployer - The deployer wallet.
 * @param recordRegistryAddr - The address of the ZkKYC record registry.
 * @param sbtData - The data of the verification SBT.
 * @returns The deployed contracts.
 */
export async function deployKYCRequirementsDemoDApp(
  deployer: SignerWithAddress,
  recordRegistryAddr: string,
  sbtData: TokenData,
): Promise<{
  zkpVerifier: any;
  ageCitizenshipKYC: any;
  kycRequirementsDemoDApp: any;
  compliantERC20: any;
  sbtAddr: string;
}> {
  log(`Using account ${deployer.address} to deploy contracts`);
  log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  const poseidon = (await buildPoseidon()) as Poseidon;

  // deploying everything
  const zkpVerifier = await deploySC('AgeCitizenshipKYCVerifier', true);

  const ageCitizenshipKYC = await deploySC('AgeCitizenshipKYC', true, {}, [
    deployer.address,
    zkpVerifier.address,
    recordRegistryAddr,
    // sanctioned countries: undefined ("1") + hash of Iran + hash of USA + placeholders
    [
      '1',
      hashStringToFieldNumber('IRN', poseidon),
      hashStringToFieldNumber('USA', poseidon),
    ].concat(Array(17).fill('0')),
    // no investigation institutions
    [],
    18,
  ]);

  const kycRequirementsDemoDApp = await deploySC(
    'KYCRequirementsDemoDApp',
    true,
    {},
    [ageCitizenshipKYC.address, sbtData.uri, sbtData.name, sbtData.symbol],
  );
  const verificationSBTAddr = await kycRequirementsDemoDApp.SBT();

  const compliantERC20 = await deploySC('CompliantERC20', true, {}, [
    'Compliant ERC20',
    'CERC20',
    deployer.address,
    parseEther('1000000'),
    verificationSBTAddr,
    [kycRequirementsDemoDApp.address],
  ]);

  const sbtAddr = await kycRequirementsDemoDApp.SBT();

  await tryVerification(
    sbtAddr,
    [
      sbtData.uri,
      sbtData.name,
      sbtData.symbol,
      kycRequirementsDemoDApp.address,
    ],
    'contracts/SBT_related/VerificationSBT.sol:VerificationSBT',
  );

  return {
    zkpVerifier,
    ageCitizenshipKYC,
    kycRequirementsDemoDApp,
    compliantERC20,
    sbtAddr,
  };
}
