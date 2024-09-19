/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';

import { AgeCitizenshipKYC } from '../typechain-types/contracts/AgeCitizenshipKYC';
import { hashStringToFieldNumber } from '../lib/helpers';
import { buildPoseidon } from 'circomlibjs';

/**
 * Script for changing the sanction list of a verifier.
 */
async function main() {
  // parameters
  const verifierAddress = '0x9a06c72f2c0423AFe9EceD128c00C063020D31B9';
  const poseidon = (await buildPoseidon());
  const sanctionList = ['1', hashStringToFieldNumber('IRN', poseidon), hashStringToFieldNumber('USA', poseidon)]

  console.log('Setting new sanction list for verifier:', verifierAddress);
  console.log('New requirements:', sanctionList);

  // get contract
  const verifier = await ethers.getContractAt(
    'AgeCitizenshipKYC',
    verifierAddress,
  ) as AgeCitizenshipKYC;

  await verifier.setSanctionedCountries(sanctionList);

  console.log('done');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
