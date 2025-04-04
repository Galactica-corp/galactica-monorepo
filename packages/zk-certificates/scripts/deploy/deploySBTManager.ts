/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers, network } from 'hardhat';

/**
 * Deploys a contract that everyone can use to submit encrypted Data for on-chain storage.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const deployNewSBTManagerFlag = false;
  const checkSBTManagerFlag = true;

  console.log(
    `Deploying contracts with account ${deployer.address} on network ${network.name}`,
  );

  console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  if (deployNewSBTManagerFlag) {
    const SBTManagerRegistry = await ethers.getContractFactory('SBTManager');
    const SBTManagerInstance = await SBTManagerRegistry.deploy(
      deployer.address,
    );

    console.log(
      `The address of the newly deployed SBTManager contract is ${SBTManagerInstance.address}`,
    );
  }

  if (checkSBTManagerFlag) {
    const SBTManagerAddress = '0x3e2Ae72c127008e738EeF1Ea5b83594558095451';
    const SBTManagerInstance = await ethers.getContractAt(
      'SBTManager',
      SBTManagerAddress,
    );
    console.log(
      `Checking the existing SBTManager contract is ${SBTManagerInstance.address}`,
    );

    for (let i = 0; i < 5; i++) {
      const VerificationSBTAddress =
        await SBTManagerInstance.SBTIndexToSBTAddress(i);
      const SBTInstance = await ethers.getContractAt(
        'VerificationSBT',
        VerificationSBTAddress,
      );
      const SBTName = await SBTInstance.name();
      const SBTUri = await SBTInstance.baseURI();
      const SBTsymbol = await SBTInstance.symbol();
      console.log(`SBT ${i} address is ${VerificationSBTAddress}`);
      console.log(`SBT ${i} name is ${SBTName}`);
      console.log(`SBT ${i} uri is ${SBTUri}`);
      console.log(`SBT ${i} symbol is ${SBTsymbol}`);
      const VerifierWrapperAddress =
        await SBTManagerInstance.SBTIndexToSBTVerifierWrapper(i);
      const VerifierWrapperInstance = await ethers.getContractAt(
        'IVerifierWrapper',
        VerifierWrapperAddress,
      );
      const VerifierAddress = await VerifierWrapperInstance.verifier();
      console.log(`SBT ${i} verifierWrapper is ${VerifierWrapperAddress}`);
      console.log(`SBT ${i} verifier is ${VerifierAddress}`);
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
