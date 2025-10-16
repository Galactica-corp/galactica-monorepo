// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import repeatableZKPTestModule from './RepeatableZKPTest.m';

const BasicKYCExampleModule = buildModule('BasicKYCExampleModule', (module) => {
  const { zkKYCSC } = module.useModule(repeatableZKPTestModule);

  // SBT parameters
  const sbtUri = module.getParameter(
    'sbtUri',
    'ipfs://QmdYZJP26w8dXHvR9g5Bykw4Ziqvgrst6p9XesZeR1qa2R',
  );
  const sbtName = module.getParameter('sbtName', 'KYC Verification SBT');
  const sbtSymbol = module.getParameter('sbtSymbol', 'KYCOK');

  // Deploy BasicKYCExampleDApp
  const dApp = module.contract(
    'contracts/dapps/BasicKYCExampleDApp.sol:BasicKYCExampleDApp',
    [zkKYCSC, sbtUri, sbtName, sbtSymbol],
  );

  const sbtAddr = module.staticCall(dApp, 'sbt', []);
  const sbt = module.contractAt('VerificationSBT', sbtAddr);

  return {
    dApp,
    sbt,
  };
});

export default BasicKYCExampleModule;
