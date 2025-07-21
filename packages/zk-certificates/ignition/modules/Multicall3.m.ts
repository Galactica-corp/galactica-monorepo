// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const Multicall3Module = buildModule('Multicall3Module', (module) => {
  // Deploy Multicall3 library
  const multicall3 = module.contract('Multicall3', []);

  return { multicall3 };
});

export default Multicall3Module;