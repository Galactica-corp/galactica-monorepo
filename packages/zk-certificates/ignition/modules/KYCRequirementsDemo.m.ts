// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const KYCRequirementsDemoModule = buildModule('KYCRequirementsDemoModule', (module) => {
  // Get deployer account
  const deployer = module.getAccount(0);

  // Parameters
  const recordRegistryAddr = module.getParameter('recordRegistryAddr', '0x68272A56A0e9b095E5606fDD8b6c297702C0dfe5');
  
  // SBT parameters with defaults
  const sbtUri = module.getParameter('sbtUri', 'ipfs://QmRXjRe3w6ZTbuf1yhanzkEcvyyB9HymkNf4NMQQk5pNpC');
  const sbtName = module.getParameter('sbtName', 'Compliance Demo Verification SBT');
  const sbtSymbol = module.getParameter('sbtSymbol', 'COMP');

  // Deploy AgeCitizenshipKYCVerifier
  const zkpVerifier = module.contract('AgeCitizenshipKYCVerifier', []);

  // Deploy AgeCitizenshipKYC wrapper with sanctioned countries
  // sanctioned countries: undefined ("1") + hash of Iran + hash of USA + placeholders
  const sanctionedCountries = [
    '1', // undefined 
    '13234116648699046051033406700729289847632558216862093650885476830670844623765', // hash of 'IRN'
    '20127816046968593389020923710838449693892100023326705503932851502896988843948', // hash of 'USA'
    ...Array(17).fill('0') // placeholders
  ];

  const ageCitizenshipKYC = module.contract('AgeCitizenshipKYC', [
    deployer,
    zkpVerifier,
    recordRegistryAddr,
    sanctionedCountries,
    [], // no investigation institutions
    18, // age threshold
  ]);

  // Deploy KYCRequirementsDemoDApp
  const kycRequirementsDemoDApp = module.contract('KYCRequirementsDemoDApp', [
    ageCitizenshipKYC,
    sbtUri,
    sbtName,
    sbtSymbol,
  ]);

  return {
    zkpVerifier,
    ageCitizenshipKYC,
    kycRequirementsDemoDApp,
  };
});

export default KYCRequirementsDemoModule;