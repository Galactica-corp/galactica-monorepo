// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { ethers } from 'hardhat';

import stakingModule from '../Staking.m';

/**
 * Using the Transparent Proxy pattern from OpenZeppelin: https://docs.openzeppelin.com/contracts/5.x/api/proxy#TransparentUpgradeableProxy
 * Documentation how to use it with Hardhat Ignition: https://hardhat.org/ignition/docs/guides/upgradeable-proxies
 */
const UpgradedTestStakingModule = buildModule(
  'UpgradedTestStakingModule',
  (module) => {
    // Include dependency on staking and reward tokens
    const { proxyAdmin, proxy, timelockController } =
      module.useModule(stakingModule);

    const newVersion = module.getParameter('newVersion', '2.0.0');

    // Deploying the upgraded logic contract
    const upgradedStakingImpl = module.contract('TestStakingUpgrade', [], {
      id: 'TestStakingUpgradeImplementation',
    });

    // Call to reinitialize the staking contract after the upgrade
    const encodedInitCall = module.encodeFunctionCall(
      upgradedStakingImpl,
      'reinitialize',
      [newVersion],
    );

    // Call to upgrade the proxy to the new implementation
    const encodedUpgradeCall = module.encodeFunctionCall(
      proxyAdmin,
      'upgradeAndCall',
      [proxy, upgradedStakingImpl, encodedInitCall],
    );

    // Schedule upgrade call through the timelock controller
    const delay = module.staticCall(timelockController, 'getMinDelay');
    const scheduledUpgrade = module.call(timelockController, 'schedule', [
      proxyAdmin,
      0,
      encodedUpgradeCall,
      ethers.ZeroHash,
      ethers.ZeroHash,
      delay,
    ]);

    // Now we would have to wait for the timelock to pass.
    // The module can fail here, so that we can resume it after the lock has passed.
    // For the test, we can just set the timelock duration to 0

    // Execute the upgrade call after the timelock has passed
    module.call(
      timelockController,
      'execute',
      [proxyAdmin, 0, encodedUpgradeCall, ethers.ZeroHash, ethers.ZeroHash],
      // ensure that the execution is called after the scheduled upgrade. Ignition would batch it together otherwise.
      { after: [scheduledUpgrade] },
    );

    // V2 Staking interface using the proxy
    const upgradedStaking = module.contractAt('TestStakingUpgrade', proxy);

    return { upgradedStaking, proxyAdmin, proxy };
  },
);

export default UpgradedTestStakingModule;
