// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import infrastructureModule from './Infrastructure.m';

const ExampleDAppModule = buildModule('ExampleDAppModule', (module) => {
  const { zkKYCRegistry, institution1, institution2, institution3 } =
    module.useModule(infrastructureModule);

  // Get deployer account
  const deployer = module.getAccount(0);

  // SBT parameters
  const sbtUri = module.getParameter(
    'sbtUri',
    'ipfs://QmX2EppfoPMNEMqf55CsTHJr1565UheAonDGb9w1bAW96z',
  );
  const sbtName = module.getParameter('sbtName', 'Airdrop Example SBT');
  const sbtSymbol = module.getParameter('sbtSymbol', 'KYCDROP');
  const ageThreshold = module.getParameter('ageThreshold', 0);

  // Deploy MockZkKYC as verifier
  const ageCitizenshipKYCVerifier = module.contract(
    'contracts/zkpVerifiers/AgeCitizenshipKYCVerifier.sol:AgeCitizenshipKYCVerifier',
    [],
  );

  // Deploy AgeCitizenshipKYC wrapper
  const ageCitizenshipKYC = module.contract(
    'contracts/verifierWrappers/AgeCitizenshipKYC.sol:AgeCitizenshipKYC',
    [
      deployer,
      ageCitizenshipKYCVerifier,
      zkKYCRegistry,
      [], // sanctioned countries
      [institution1, institution2, institution3], // fraud investigation institutions
      ageThreshold,
    ],
  );

  // Deploy MockToken
  const mockToken1 = module.contract(
    'contracts/mock/MockToken.sol:MockToken',
    [deployer],
    { id: 'DeployMockToken1' },
  );
  const mockToken2 = module.contract(
    'contracts/mock/MockToken.sol:MockToken',
    [deployer],
    { id: 'DeployMockToken2' },
  );

  // Deploy MockDApp
  const mockDApp = module.contract('contracts/mock/MockDApp.sol:MockDApp', [
    ageCitizenshipKYC,
    sbtUri,
    sbtName,
    sbtSymbol,
  ]);

  module.call(mockDApp, 'setToken1', [mockToken1], { id: 'SetToken1' });
  module.call(mockDApp, 'setToken2', [mockToken2], { id: 'SetToken2' });

  const sbtAddr = module.staticCall(mockDApp, 'sbt', []);
  const sbt = module.contractAt('VerificationSBT', sbtAddr);

  return {
    ageCitizenshipKYCVerifier,
    ageCitizenshipKYC,
    mockToken1,
    mockToken2,
    mockDApp,
    sbt,
  };
});

export default ExampleDAppModule;
