// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { ethers } from 'hardhat';

import { defineUpgradableProxy } from './UpgradableProxy.m';

const StakingModule = buildModule('StakingModule', (module) => {
  // Staking parameters
  // 4% unstaking fee, considering the denominator is 1e4
  const unstakingFeeRatio = module.getParameter(
    'unstakingFeeRatio',
    0.04 * 1e4,
  );
  const owner = module.getParameter('owner', module.getAccount(0));
  const emissionStart = module.getParameter('emissionStart', 0);
  const firstCheckPoint = module.getParameter('firstCheckPoint', 1);
  const rewardPerSecond = module.getParameter(
    'rewardPerSecond',
    ethers.parseEther('0'),
  );

  const { upgradableContract: staking, proxyContracts } = defineUpgradableProxy(
    module,
    'Staking',
    [unstakingFeeRatio, owner, emissionStart, firstCheckPoint, rewardPerSecond],
  );

  return { staking, ...proxyContracts };
});

export default StakingModule;
