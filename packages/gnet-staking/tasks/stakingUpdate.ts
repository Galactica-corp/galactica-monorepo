import { ethers } from 'ethers';
import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import {
  askUserConfirmation,
  getDeploymentAddr,
  timestampFromString,
  dateStringFromTimestamp,
} from './utils';
import type { Staking } from '../typechain-types/contracts/staking/Staking';

/**
 * Script for adding an emission period to the staking contract schedule.
 *
 * @param args - See task definition below or 'npx hardhat createZkCertificate --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  const [admin] = await hre.ethers.getSigners();

  const balance = await hre.ethers.provider.getBalance(admin.address);

  console.log('Admin balance:', ethers.formatEther(balance), 'ETH');

  const contractAddr = await getDeploymentAddr(
    hre,
    'StakingModule#UpgradableContractStaking',
    args.deploymentId,
  );
  console.log('Staking contract address:', contractAddr);

  const staking = (await hre.ethers.getContractAt(
    'Staking',
    contractAddr,
  )) as unknown as Staking;

  const previousCheckPoints = await staking.getCheckPoints();
  const previousRewardPerSecond = await staking.getRewardPerSecond();

  const newCheckpoint = timestampFromString(args.checkpoint);
  const newRewardPerSecond = BigInt(args.rewardsPerSecond);

  console.log(
    'Last emission period start:',
    dateStringFromTimestamp(
      Number(previousCheckPoints[previousCheckPoints.length - 2]),
    ),
  );
  console.log(
    'Last emission period end:',
    dateStringFromTimestamp(
      Number(previousCheckPoints[previousCheckPoints.length - 1]),
    ),
  );
  console.log(
    'Last reward per second:',
    previousRewardPerSecond[previousRewardPerSecond.length - 1],
  );
  console.log();
  console.log(
    'New emission period:',
    dateStringFromTimestamp(newCheckpoint),
    ' = ',
    newCheckpoint,
  );
  console.log('New reward per second:', newRewardPerSecond);
  console.log();

  if (
    !(await askUserConfirmation(
      'Are you sure you want to update the staking contract schedule?',
    ))
  ) {
    console.log('Exiting...');
    process.exit(0);
  }

  console.log('Updating staking contract schedule...');
  await staking.updateSchedule(newCheckpoint, newRewardPerSecond);
  console.log('Staking contract schedule updated successfully');
}

task(
  'stakingUpdate',
  'Adds an emission period to the staking contract schedule',
)
  .addParam(
    'checkpoint',
    'The timestamp when the new emission period ends',
    undefined,
    types.string,
    false,
  )
  .addParam(
    'rewardsPerSecond',
    'The reward per second in wei of the reward token',
    undefined,
    types.bigint,
    false,
  )
  .addParam(
    'deploymentId',
    'The deployment id of the staking contract',
    undefined,
    types.string,
    true,
  )
  .setAction(async (taskArgs, hre) => {
    await main(taskArgs, hre).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
