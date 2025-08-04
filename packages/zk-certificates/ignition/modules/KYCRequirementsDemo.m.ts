// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import sanctionList from '../params/sanction_list.json';

const KYCRequirementsDemoModule = buildModule(
  'KYCRequirementsDemoModule',
  (module) => {
    // Get deployer account
    const deployer = module.getAccount(0);

    // Parameters
    const recordRegistryAddr = module.getParameter(
      'recordRegistryAddr',
      '0x68272A56A0e9b095E5606fDD8b6c297702C0dfe5',
    );

    // SBT parameters with defaults
    const sbtUri = module.getParameter(
      'sbtUri',
      'ipfs://QmRXjRe3w6ZTbuf1yhanzkEcvyyB9HymkNf4NMQQk5pNpC',
    );
    const sbtName = module.getParameter(
      'sbtName',
      'Compliance Demo Verification SBT',
    );
    const sbtSymbol = module.getParameter('sbtSymbol', 'COMP');

    // Deploy AgeCitizenshipKYCVerifier
    const zkpVerifier = module.contract('AgeCitizenshipKYCVerifier', []);

    // Deploy AgeCitizenshipKYC wrapper with sanctioned countries
    // sanctioned countries: undefined ("1") + hash of Iran + hash of USA + placeholders
    const sanctionedCountries = [
      '1', // undefined
      sanctionList.sanctionedCountries.IRN,
      sanctionList.sanctionedCountries.USA,
      ...Array(17).fill('0'), // placeholders
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

    const sbtAddr = module.staticCall(kycRequirementsDemoDApp, 'sbt', []);
    const sbt = module.contractAt('VerificationSBT', sbtAddr);

    return {
      zkpVerifier,
      ageCitizenshipKYC,
      kycRequirementsDemoDApp,
      sbt,
    };
  },
);

export default KYCRequirementsDemoModule;
