/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers, network } from 'hardhat';

import { deploySC } from '../../lib/hardhatHelpers';

/**
 * Deploys the Multicall3 library.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    `Deploying contracts with account ${await deployer.getAddress()} on network ${
      network.name
    }`,
  );

  console.log(
    `Account balance: ${(
      await ethers.provider.getBalance(deployer)
    ).toString()}`,
  );

  const Multicall3 = await deploySC('Multicall3', true, {}, []);

  console.log(
    `The address of the contract is ${await Multicall3.getAddress()}`,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
