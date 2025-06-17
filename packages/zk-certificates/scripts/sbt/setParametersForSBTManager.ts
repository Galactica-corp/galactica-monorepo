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

  const SBTManagerAddress = `0x3e2Ae72c127008e738EeF1Ea5b83594558095451`;
  const SBTManagerInstance = await ethers.getContractAt(
    'SBTManager',
    SBTManagerAddress,
  );
  const SBTIndex = 4;
  const SBTAddress = `0xD5E27e0cE400FD70B7543Ee686951e926737793e`;
  const SBTVerifierWrapperAddress = `0x448CED08617bf59d060fe34119A0Bd0DFEe79E7c`;
  console.log(`working with index ${SBTIndex}`);

  console.log(`setting SBT adress to ${SBTAddress}`);
  await SBTManagerInstance.setSBT(SBTIndex, SBTAddress);

  console.log(
    `setting SBT verifier wrapper adress to ${SBTVerifierWrapperAddress}`,
  );
  await SBTManagerInstance.setVerifierWrapper(
    SBTIndex,
    SBTVerifierWrapperAddress,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
