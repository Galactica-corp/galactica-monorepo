/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers, network } from 'hardhat';

/**
 * Deploys a contract that everyone can use to submit encrypted Data for on-chain storage.
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

  const SBTAddress = '0x897717462BC1cb41Ab42A21fF135bEfb193fc26E';
  const SBT = await ethers.getContractAt('GalacticaOfficialSBT', SBTAddress);
  const receiverAddress = '0x19db2f832Fa74dC80Dc936A47083073072Aa5818';

  console.log(`going to mint SBT ${SBTAddress} to ${receiverAddress}`);
  const tx = await SBT.mint(receiverAddress);
  await tx.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
