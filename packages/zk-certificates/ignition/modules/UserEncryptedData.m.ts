// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const UserEncryptedDataModule = buildModule('UserEncryptedDataModule', (module) => {
  // Deploy UserEncryptedData contract for on-chain encrypted data storage
  const userEncryptedData = module.contract('UserEncryptedData', []);

  return { userEncryptedData };
});

export default UserEncryptedDataModule;