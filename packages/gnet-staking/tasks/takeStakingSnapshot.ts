import { ethers } from 'ethers';
import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import path from 'path';

import {
  askUserConfirmation,
  getDeploymentAddr,
  getDeploymentBlock,
  dateStringFromTimestamp,
  getLogs,
  writeCSV,
} from './utils';
import type { Staking } from '../typechain-types/contracts/Staking';

const MAX_LOGS = 10;

/**
 * Task for taking a snapshot of balances in the staking contract.
 *
 * @param args - See task definition below or 'npx hardhat takeStakingSnapshot --help'.
 * @param hre - Hardhat runtime environment.
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  const contractAddr = await getDeploymentAddr(
    hre,
    'StakingModule#UpgradableContractStaking',
    args.deploymentId,
  );
  const staking = (await hre.ethers.getContractAt(
    'Staking',
    contractAddr,
  )) as unknown as Staking;

  const deploymentBlock = await getDeploymentBlock(
    hre,
    'StakingModule#TransparentUpgradeableProxyStaking',
    args.deploymentId,
  );
  console.log(`Deployment block: ${deploymentBlock}`);
  const { snapshotBlock } = args;
  console.log(`Taking snapshot at block number: ${snapshotBlock}`);

  // Get the block to retrieve its timestamp
  const block = await hre.ethers.provider.getBlock(Number(snapshotBlock));
  if (!block) {
    console.error(`Block ${snapshotBlock} not found`);
    process.exit(1);
  }
  const snapshotTimestamp = block.timestamp;
  if (
    !(await askUserConfirmation(
      `Is this the correct snapshot time: ${dateStringFromTimestamp(Number(snapshotTimestamp))}?`,
    ))
  ) {
    process.exit(0);
  }

  const createStakeEvent = staking.interface.getEvent('CreateStake');
  const createEvents = await getLogs(
    hre,
    staking,
    createStakeEvent,
    deploymentBlock,
    snapshotBlock,
    MAX_LOGS,
  );

  // Process the events if needed
  if (createEvents.length > 0) {
    console.log('Sample event data:', createEvents[0]);
  }

  const stakeBalances: Record<string, bigint> = {};
  for (const event of createEvents) {
    const [staker, amount] = event.args;
    stakeBalances[staker] ??= BigInt(0);
    stakeBalances[staker] += BigInt(amount);
  }

  const removeStakeEvent = staking.interface.getEvent('RemoveStake');
  const removeEvents = await getLogs(
    hre,
    staking,
    removeStakeEvent,
    deploymentBlock,
    snapshotBlock,
    MAX_LOGS,
  );
  for (const event of removeEvents) {
    const [staker, amount] = event.args;
    stakeBalances[staker] ??= BigInt(0);
    stakeBalances[staker] -= BigInt(amount);
  }

  // Sainity check on balance data
  let totalStake = BigInt(0);
  for (const [staker, balance] of Object.entries(stakeBalances)) {
    if (balance < BigInt(0)) {
      console.error(`Balance for staker ${staker} is negative: ${balance}`);
      process.exit(1);
    }
    totalStake += balance;
  }
  const stakeInContract = await staking.totalStake();
  if (totalStake !== stakeInContract) {
    console.warn(
      `Current total stake in contract (${ethers.formatEther(stakeInContract)}) does not match total stake in snapshot (${ethers.formatEther(totalStake)})`,
    );
    console.warn(
      `Please check if this is consistent with the stake changes since the snapshot block ${snapshotBlock}`,
    );
  }
  console.log(`Total stake: ${ethers.formatEther(totalStake)}`);

  // Format the contract address and block range for the filename
  const contractAddress = await staking.getAddress();
  const shortAddress = contractAddress.substring(0, 8); // Use first 8 chars of address
  const filename = path.join(
    __dirname,
    '../data',
    `staking_snapshot_${shortAddress}_${deploymentBlock}_to_${snapshotBlock}.csv`,
  );

  // Write to file
  writeCSV(
    filename,
    ['staker', 'balance', 'balanceEther'],
    Object.entries(stakeBalances).map(([staker, balance]) => [
      staker,
      balance.toString(),
      ethers.formatEther(balance),
    ]),
  );
  console.log(`Snapshot data written to ${filename}`);
  console.log('done');
}

task(
  'takeStakingSnapshot',
  'Take a snapshot of balances in the staking contract',
)
  .addParam(
    'snapshotBlock',
    'The block number to take the snapshot at',
    undefined,
    types.int,
    false,
  )
  .addParam(
    'deploymentId',
    'The ignition deployment ID for finding the contract address',
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
