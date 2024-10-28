/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import chalk from 'chalk';
import type { Contract, Signer } from 'ethers';
import { ethers, run } from 'hardhat';
import type { FactoryOptions } from 'hardhat/types';

/**
 * Helper function to deploy a smart contract and verify it on the block explorer.
 * @param name - Name of the smart contract.
 * @param verify - Whether to verify the contract on the block explorer.
 * @param signerOrOptions - Signer or options as taken by hardhat.
 * @param constructorArgs - Constructor arguments as array or undefined when empty.
 * @returns Promise of the deployed contract.
 */
export async function deploySC(
  name: string,
  verify?: boolean,
  signerOrOptions?: Signer | FactoryOptions | undefined,
  constructorArgs?: any[] | undefined,
): Promise<Contract> {
  console.log(`Deploying ${name}...`);
  const factory = await ethers.getContractFactory(name, signerOrOptions);

  let contract: Contract;
  if (constructorArgs === undefined) {
    contract = await factory.deploy();
  } else {
    contract = await factory.deploy(...constructorArgs);
  }
  await contract.deployed();

  console.log(chalk.green(`${name} deployed to ${contract.address}`));
  console.log('constructorArgs:', JSON.stringify(constructorArgs));

  if (verify) {
    // if (constructorArgs && constructorArgs?.length !== 0) {
    //   console.warn(
    //     `Skipping automatic verification of ${name} because of a bug with constructor arguments when using hardhat-ethersan and blockscout. You can still verify it manually.`,
    //   );
    //   return contract;
    // }
    try {
      // in case there are multiple contracts with the same bytecode (e.g. tokens), we need to pass the fully qualified name to the verifier
      let contractArgs = {};
      if (name.includes('.sol:')) {
        contractArgs = { contract: name };
      }

      await run('verify:verify', {
        address: contract.address,
        constructorArguments: constructorArgs,
        ...contractArgs,
        ...signerOrOptions,
      });
    } catch (error: any) {
      console.error(
        chalk.red(`Verification failed: ${error.message as string}`),
      );
      if (error.message.includes('not found')) {
        console.error(
          chalk.red(
            `If you get a file not found error, try running 'npx hardhat clean' first`,
          ),
        );
      }
    }
  }
  return contract;
}

/**
 * Helper to try verifying a contract and log an error if it fails. If it fails, it will also log the command to run verification later.
 * @param address - Address of the contract.
 * @param constructorArguments - Constructor arguments used for deployment.
 * @param contract - Fully qualified name of the contract (e.g. "contracts/SBT_related/VerificationSBT.sol:VerificationSBT").
 * @param options - Options as taken by hardhat, such as library addresses.
 */
export async function tryVerification(
  address: string,
  constructorArguments: any[],
  contract: string,
  options: FactoryOptions = {},
) {
  try {
    await run('verify:verify', {
      address,
      constructorArguments,
      contract,
      ...options,
    });
  } catch (error: any) {
    console.error(chalk.red(`Verification failed: ${error.message as string}`));
    console.error(
      chalk.red(
        `Sometimes the block explorer is slow to update. Try again in a few minutes.`,
      ),
    );
    console.log(`Command to run verification later:`);
    console.log(
      chalk.yellow(
        `yarn hardhat verify --contract "${contract}" ${address} "${constructorArguments.join(
          '" "',
        )}" --network [NETWORK] `,
      ),
    );
  }
}
