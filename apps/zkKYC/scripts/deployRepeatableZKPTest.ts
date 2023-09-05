/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import hre from "hardhat";
import { deploySC } from '../lib/hardhatHelpers';

const log = console.log;


async function main() {
  // parameters
  const verificationSBT = '0xc1a96F7DD532fa4B774C41f9Eb853893314cB036';
  const zkKYCRegistry = '0x8eD8311ED65eBe2b11ED8cB7076E779c1030F9cF';

  // wallets
  const [deployer] = await hre.ethers.getSigners();
  log(`Using account ${deployer.address} to deploy contracts`);
  log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  // deploying everything
  const zkKYCVerifier = await deploySC('ZkKYCVerifier', true);
  const zkKYCSC = await deploySC('ZkKYC', true, {}, [
    deployer.address,
    zkKYCVerifier.address,
    zkKYCRegistry,
    [],
  ]);
  await deploySC('RepeatableZKPTest', true, {},
    [verificationSBT, zkKYCSC.address]
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
