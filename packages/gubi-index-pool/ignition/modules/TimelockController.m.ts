// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

/*
 * Deploy the TimelockController for upgrades
 * To enforce a timelock on upgrades, the TimelockController contract is the owner of the ProxyAdmin
 * Thus all upgrade requests have to be made through the TimelockController
 */
const TimelockControllerModule = buildModule(
  'TimelockControllerModule',
  (module) => {
    const minDelay = module.getParameter('minDelay', 3 * 24 * 60 * 60); // 3 days
    const proposer = module.getParameter('proposer', module.getAccount(0));
    const executor = module.getParameter('executor', module.getAccount(0));
    const admin = module.getParameter('admin', module.getAccount(0));

    const timelockController = module.contract('TimelockController', [
      minDelay,
      [proposer],
      [executor],
      admin,
    ]);

    // Revoke the admin role from the timelock controller, so that future upgrades need to consider the timelock
    const defaultAdminRole = module.staticCall(
      timelockController,
      'DEFAULT_ADMIN_ROLE',
    );
    module.call(timelockController, 'revokeRole', [defaultAdminRole, admin]);

    return { timelockController };
  },
);

export default TimelockControllerModule;
