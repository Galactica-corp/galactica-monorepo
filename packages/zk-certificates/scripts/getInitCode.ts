import { ethers } from 'hardhat';

/**
 * This script deploys a CalHash contract and retrieves the initcode hash of the UniswapV2Pair contract.
 * The initcode hash is needed for hardcoding in the UniswapV2Library.
 */
async function main() {
  console.log(`Operating in network ${hre.network.name}`);

  const [deployer] = await ethers.getSigners();

  console.log('Deploying contracts with the account:', deployer.address);

  console.log('Account balance:', (await deployer.getBalance()).toString());

  const CalHashFactory = await ethers.getContractFactory('CalHash');
  const CalHashInstance = await CalHashFactory.deploy();

  console.log('CalHash address:', CalHashInstance.address);

  console.log(`initcode hash is ${await CalHashInstance.getInitHash()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

export {};
