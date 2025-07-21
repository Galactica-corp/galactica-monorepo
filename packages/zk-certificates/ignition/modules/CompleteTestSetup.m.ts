// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import basicKYCExampleModule from './BasicKYCExample.m';
import exampleDAppModule from './ExampleDApp.m';
import infrastructureModule from './Infrastructure.m';
import repeatableZKPTestModule from './RepeatableZKPTest.m';

const CompleteTestSetupModule = buildModule('CompleteTestSetupModule', (module) => {
  // Use all submodules
  const infrastructure = module.useModule(infrastructureModule);
  const exampleDApp = module.useModule(exampleDAppModule);
  const repeatableZkKYC = module.useModule(repeatableZKPTestModule);
  const basicKYCExample = module.useModule(basicKYCExampleModule);

  // Get deployer account for guardian whitelisting
  const deployer = module.getAccount(0);

  // Guardian metadata
  const guardianMetadata = module.getParameter(
    'guardianMetadata',
    'ipfs://QmbxKQbSU2kMRx3Q96JWFvezKVCKv8ik4twKg7SFktkrgx',
  );

  // Whitelist the deployer as a guardian
  module.call(
    infrastructure.guardianRegistry,
    'grantGuardianRole',
    [deployer, guardianMetadata],
  );

  return {
    infrastructure,
    exampleDApp,
    repeatableZkKYC,
    basicKYCExample,
  };
});

export default CompleteTestSetupModule;