/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';

import { CompliantERC20 } from '../typechain-types/contracts/CompliantERC20';

/**
 * Script for adding a KYC center to the KYC center registry.
 */
async function main() {
  // parameters
  const tokenAddress = '0xf4a29A8d8111b392a726a6fA5bd1ab8dcC99b814';
  const newRequirements = ['0x8631988B52A975AaC20e5E75836D22817426aeE5']

  console.log('Setting new requirements for token:', tokenAddress);
  console.log('New requirements:', newRequirements);

  // get contract
  const token = await ethers.getContractAt(
    'KYCRequirementsDemoDApp',
    tokenAddress,
  ) as CompliantERC20;

  await token.setCompliancyRequirements(newRequirements);

  console.log('done');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
