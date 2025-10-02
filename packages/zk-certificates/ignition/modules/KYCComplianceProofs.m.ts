// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import infrastructureModule from './Infrastructure.m';
import sanctionList from '../params/sanction_list.json';

const KYCComplianceProofsModule = buildModule(
  'KYCComplianceProofsModule',
  (module) => {
    // Get deployer account
    const deployer = module.getAccount(0);

    const { zkKYCRegistry } = module.useModule(infrastructureModule);

    // SBT parameters with defaults
    const nonUSSBTData = {
      uri: module.getParameter(
        'nonUSUri',
        'ipfs://Qmc7fCZDftWvgsPuW2kVALEdUWWWTq9oKTP3vUXpct6mgP',
      ),
      name: module.getParameter('nonUSName', 'KYC Non-US Verification'),
      symbol: module.getParameter('nonUSSymbol', 'NONUS'),
    };

    const nonSanctionedSBTData = {
      uri: module.getParameter(
        'nonSanctionedUri',
        'ipfs://QmcxfT4459adX7PX9j4D5AsSpe2o3ZtDN9YU9VHNzinowH',
      ),
      name: module.getParameter(
        'nonSanctionedName',
        'KYC Non-sanctioned citizenship Verification',
      ),
      symbol: module.getParameter('nonSanctionedSymbol', 'NONSAN'),
    };

    const age18SBTData = {
      uri: module.getParameter(
        'age18Uri',
        'ipfs://QmYiRsyQ3iEEVg7LUKS6E77pUbTnBoUHAXMG434bBu2Lp1',
      ),
      name: module.getParameter('age18Name', 'KYC 18+ Verification'),
      symbol: module.getParameter('age18Symbol', 'KYC18'),
    };

    // Common circom ZKP verifier
    const zkpVerifier = module.contract('AgeCitizenshipKYCVerifier', []);

    // NonUS verification setup
    const nonUSWrapper = module.contract(
      'AgeCitizenshipKYC',
      [
        deployer,
        zkpVerifier,
        zkKYCRegistry,
        // sanctioned countries: undefined ("1") + hash of USA + placeholders
        ['1', sanctionList.sanctionedCountries.USA, ...Array(18).fill('0')],
        [], // no investigation institutions
        0, // no age threshold
      ],
      { id: 'NonUSWrapper' },
    );

    const nonUSDApp = module.contract(
      'contracts/dapps/NonUSProverDApp.sol:NonUSProverDApp',
      [nonUSWrapper, nonUSSBTData.uri, nonUSSBTData.name, nonUSSBTData.symbol],
    );
    const nonUSSBTAddr = module.staticCall(nonUSDApp, 'sbt', []);
    const nonUSSBT = module.contractAt('VerificationSBT', nonUSSBTAddr, {
      id: 'NonUSSBT',
    });

    // NonSanctionedJurisdiction verification setup
    const sanctionedCountriesHashes = [
      '1', // undefined
      ...Object.values(sanctionList.sanctionedCountries).filter(
        (country: string) => country !== sanctionList.sanctionedCountries.USA,
      ),
      ...Array(4).fill('0'), // placeholders to fill up to 20 total entries
    ];

    const nonSanctionedJurisdictionWrapper = module.contract(
      'AgeCitizenshipKYC',
      [
        deployer,
        zkpVerifier,
        zkKYCRegistry,
        sanctionedCountriesHashes,
        [], // no investigation institutions
        0, // no age threshold
      ],
      { id: 'NonSanctionedWrapper' },
    );

    const nonSanctionedJurisdictionDApp = module.contract(
      'contracts/dapps/NonSanctionedProverDApp.sol:NonSanctionedProverDApp',
      [
        nonSanctionedJurisdictionWrapper,
        nonSanctionedSBTData.uri,
        nonSanctionedSBTData.name,
        nonSanctionedSBTData.symbol,
      ],
    );

    const nonSanctionedSBTAddr = module.staticCall(
      nonSanctionedJurisdictionDApp,
      'sbt',
      [],
    );
    const nonSanctionedSBT = module.contractAt(
      'VerificationSBT',
      nonSanctionedSBTAddr,
      { id: 'NonSanctionedSBT' },
    );

    // Adult18Plus verification setup
    const adult18PlusWrapper = module.contract(
      'AgeCitizenshipKYC',
      [
        deployer,
        zkpVerifier,
        zkKYCRegistry,
        ['1', ...Array(19).fill('0')], // no sanctioned countries
        [], // no investigation institutions
        18, // age threshold
      ],
      { id: 'Adult18PlusWrapper' },
    );

    const adult18PlusDApp = module.contract(
      'contracts/dapps/Age18ProverDApp.sol:Age18ProverDApp',
      [
        adult18PlusWrapper,
        age18SBTData.uri,
        age18SBTData.name,
        age18SBTData.symbol,
      ],
    );

    const adult18PlusSBTAddr = module.staticCall(adult18PlusDApp, 'sbt', []);
    const adult18PlusSBT = module.contractAt(
      'VerificationSBT',
      adult18PlusSBTAddr,
      { id: 'Adult18PlusSBT' },
    );

    return {
      zkpVerifier,
      nonUSWrapper,
      nonUSDApp,
      nonSanctionedJurisdictionWrapper,
      nonSanctionedJurisdictionDApp,
      adult18PlusWrapper,
      adult18PlusDApp,
      nonUSSBT,
      nonSanctionedSBT,
      adult18PlusSBT,
    };
  },
);

export default KYCComplianceProofsModule;
