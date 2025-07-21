// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import infrastructureModule from './Infrastructure.m';

const RepeatableZKPTestModule = buildModule('RepeatableZKPTestModule', (module) => {
  const { zkKYCRegistry } = module.useModule(infrastructureModule);

  // Get the deployer account
  const deployer = module.getAccount(0);

  // SBT parameters
  const sbtUri = module.getParameter('sbtUri', 'ipfs://QmVG5b34f8DHGnPZQwi1GD4NUXEVhh7bTub5SG6MPHvHz6');
  const sbtName = module.getParameter('sbtName', 'Repeatable KYC Verification SBT');
  const sbtSymbol = module.getParameter('sbtSymbol', 'KYCREP');

  // Deploy MockZkKYC (instead of real verifier for testing)
  const zkKYCVerifier = module.contract('MockZkKYC', []);

  // Deploy ZkKYC wrapper
  const zkKYCSC = module.contract(
    'contracts/verifierWrappers/ZkKYC.sol:ZkKYC',
    [deployer, zkKYCVerifier, zkKYCRegistry, []],
    {
      id: 'ZkKYC'
    }
  );

  // Deploy RepeatableZKPTest
  const repeatableZKPTest = module.contract(
    'RepeatableZKPTest',
    [zkKYCSC, sbtUri, sbtName, sbtSymbol]
  );

  return {
    zkKYCVerifier,
    zkKYCSC,
    repeatableZKPTest,
  };
});

export default RepeatableZKPTestModule;