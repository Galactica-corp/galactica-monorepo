// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { ethers } from 'hardhat';

const TransferTimelockOwnershipModule = buildModule(
  'TransferTimelockOwnershipModule',
  (module) => {
    const newOwner = module.getParameter('newOwner', module.getAccount(0));
    const timelockControllerAddress = module.getParameter(
      'timelockControllerAddress',
      '0x0000000000000000000000000000000000000000',
    );

    const timelockController = module.contractAt(
      'TimelockController',
      timelockControllerAddress,
      { id: 'TransferOwnership_timelockController' },
    );

    // Calls to be batched into proposal
    const proposerRole = module.staticCall(timelockController, 'PROPOSER_ROLE');
    const grantProposerRoleCall = module.encodeFunctionCall(
      timelockController,
      'grantRole',
      [proposerRole, newOwner],
      { id: 'TransferOwnership_grantProposerRoleCall' },
    );
    const executorRole = module.staticCall(timelockController, 'EXECUTOR_ROLE');
    const grantExecutorRoleCall = module.encodeFunctionCall(
      timelockController,
      'grantRole',
      [executorRole, newOwner],
      { id: 'TransferOwnership_grantExecutorRoleCall' },
    );
    const cancellerRole = module.staticCall(
      timelockController,
      'CANCELLER_ROLE',
    );
    const grantCancellerRoleCall = module.encodeFunctionCall(
      timelockController,
      'grantRole',
      [cancellerRole, newOwner],
      { id: 'TransferOwnership_grantCancellerRoleCall' },
    );

    // Schedule upgrade call through the timelock controller
    const delay = module.staticCall(timelockController, 'getMinDelay');
    const scheduledBatch = module.call(
      timelockController,
      'scheduleBatch',
      [
        [timelockController, timelockController, timelockController],
        [0, 0, 0],
        [grantProposerRoleCall, grantExecutorRoleCall, grantCancellerRoleCall],
        ethers.ZeroHash,
        ethers.ZeroHash,
        delay,
      ],
      { id: 'TransferOwnership_scheduledBatch' },
    );

    // Now we would have to wait for the timelock to pass.
    // The module can fail here, so that we can resume it after the lock has passed.
    // For the test, we can just set the timelock duration to 0

    // Execute the call after the timelock has passed
    module.call(
      timelockController,
      'executeBatch',
      [
        [timelockController, timelockController, timelockController],
        [0, 0, 0],
        [grantProposerRoleCall, grantExecutorRoleCall, grantCancellerRoleCall],
        ethers.ZeroHash,
        ethers.ZeroHash,
      ],
      // ensure that the execution is called after the scheduled upgrade. Ignition would batch it together otherwise.
      { after: [scheduledBatch], id: 'TransferOwnership_executeBatch' },
    );

    return { timelockController };
  },
);

export default TransferTimelockOwnershipModule;
