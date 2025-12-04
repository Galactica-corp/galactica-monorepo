// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { ethers } from 'hardhat';

import { defineUpgradableProxy } from './UpgradableProxy.m';

const RewardDistributorModule = buildModule('RewardDistributorModule', (module) => {
  const owner = module.getParameter('owner', module.getAccount(0));
  const assetManager = module.getParameter('assetManager', module.getAccount(0));
  const rewardToken = module.getParameter('rewardToken', ethers.ZeroAddress);

  const { upgradableContract: rewardDistributor, proxyContracts } = defineUpgradableProxy(
    module,
    'RewardDistributor',
    [owner, assetManager, rewardToken],
  );

  return { rewardDistributor, ...proxyContracts };
});

export default RewardDistributorModule;

