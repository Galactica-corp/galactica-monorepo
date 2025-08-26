import { ethers } from 'ethers';
import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import { askUserConfirmation, getDeploymentAddr } from './utils';
import type { Staking } from '../typechain-types/contracts/staking/Staking';

/**
 * Script for changing the unstaking fee.
 *
 * @param args - See task definition below or 'npx hardhat changeUnstakingFee --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  const [admin] = await hre.ethers.getSigners();

  const balance = await hre.ethers.provider.getBalance(admin.address);

  console.log('Admin balance:', ethers.formatEther(balance), 'ETH');

  const contractAddr = await getDeploymentAddr(
    hre,
    'StakingModule#Staking',
    args.deploymentId,
  );

  const staking = (await hre.ethers.getContractAt(
    'Staking',
    contractAddr,
  )) as unknown as Staking;

  const previousUnstakingFee = await staking.unstakingFeeRatio();

  const newUnstakingFee = BigInt(args.unstakingFee);

  console.log('Staking contract address:', await staking.getAddress());
  console.log('Last unstaking fee:', previousUnstakingFee);
  console.log();
  console.log('New unstaking fee:', newUnstakingFee);
  console.log();
  console.log(
    'If the fee is increased, there is a timelock of ',
    await staking.UNSTAKING_FEE_RATIO_TIMELOCK_PERIOD(),
    'seconds before it can be changed with the `changeUnstakingFeeRatio` function',
  );
  console.log();

  if (
    !(await askUserConfirmation(
      'Are you sure you want to update the unstaking fee?',
    ))
  ) {
    console.log('Exiting...');
    process.exit(0);
  }

  console.log('Registering unstaking fee change...');
  await staking.registerNewUnstakingFeeRatio(newUnstakingFee);
  console.log('Unstaking fee change registered successfully');
}

task('registerUnstakingFeeChange', 'Registers a new unstaking fee change')
  .addParam(
    'unstakingFee',
    'The new unstaking fee',
    undefined,
    types.bigint,
    false,
  )
  .addParam(
    'deploymentId',
    'The ignition deployment id',
    undefined,
    types.string,
    false,
  )
  .setAction(async (taskArgs, hre) => {
    await main(taskArgs, hre).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
