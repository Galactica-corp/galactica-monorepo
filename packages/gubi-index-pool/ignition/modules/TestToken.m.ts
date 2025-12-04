// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const TestTokenModule = buildModule('TestTokenModule', (module) => {
  const owner = module.getParameter('owner', module.getAccount(0));

  const testToken = module.contract('TestToken', [owner]);

  return { testToken };
});

export default TestTokenModule;
