import { ethers } from 'ethers';
import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import { askUserConfirmation, getDeploymentAddr } from './utils';
import type { Staking } from '../typechain-types/contracts/staking/Staking';

/**
 * Script for setting the unstaking fee after the timelock has passed.
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
    'StakingModule#TransparentUpgradeableProxyStaking',
    args.deploymentId,
  );

  const staking = (await hre.ethers.getContractAt(
    'Staking',
    contractAddr,
  )) as unknown as Staking;

  const previousUnstakingFee = await staking.unstakingFeeRatio();
  const newUnstakingFee = await staking.newUnstakingFeeRatio();

  console.log('Staking contract address:', await staking.getAddress());
  console.log('Last unstaking fee:', previousUnstakingFee);
  console.log('New unstaking fee:', newUnstakingFee);
  console.log();

  if (
    !(await askUserConfirmation(
      'Are you sure you want to update the unstaking fee?',
    ))
  ) {
    console.log('Exiting...');
    process.exit(0);
  }

  console.log('Updating unstaking fee...');
  await staking.changeUnstakingFeeRatio();
  console.log('Unstaking fee updated successfully');
}

task('changeUnstakingFee', 'Changes the unstaking fee')
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
