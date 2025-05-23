// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const PoseidonModule = buildModule('PoseidonModule', (m) => {
  const poseidon = m.contract('PoseidonT3', []);
  return { poseidon };
});

export default PoseidonModule;
