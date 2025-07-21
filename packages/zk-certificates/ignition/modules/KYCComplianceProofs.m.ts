// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const KYCComplianceProofsModule = buildModule('KYCComplianceProofsModule', (module) => {
  // Get deployer account
  const deployer = module.getAccount(0);

  // Parameters
  const recordRegistryAddr = module.getParameter('recordRegistryAddr', '0x68272A56A0e9b095E5606fDD8b6c297702C0dfe5');

  // SBT parameters with defaults
  const nonUSSBT = {
    uri: module.getParameter('nonUSUri', 'ipfs://Qmc7fCZDftWvgsPuW2kVALEdUWWWTq9oKTP3vUXpct6mgP'),
    name: module.getParameter('nonUSName', 'KYC Non-US Verification'),
    symbol: module.getParameter('nonUSSymbol', 'NONUS'),
  };

  const nonSanctionedSBT = {
    uri: module.getParameter('nonSanctionedUri', 'ipfs://QmcxfT4459adX7PX9j4D5AsSpe2o3ZtDN9YU9VHNzinowH'),
    name: module.getParameter('nonSanctionedName', 'KYC Non-sanctioned citizenship Verification'),
    symbol: module.getParameter('nonSanctionedSymbol', 'NONSAN'),
  };

  const age18SBT = {
    uri: module.getParameter('age18Uri', 'ipfs://QmYiRsyQ3iEEVg7LUKS6E77pUbTnBoUHAXMG434bBu2Lp1'),
    name: module.getParameter('age18Name', 'KYC 18+ Verification'),
    symbol: module.getParameter('age18Symbol', 'KYC18'),
  };

  // Common circom ZKP verifier
  const zkpVerifier = module.contract('AgeCitizenshipKYCVerifier', []);

  // NonUS verification setup
  const nonUSWrapper = module.contract('AgeCitizenshipKYC', [
    deployer,
    zkpVerifier,
    recordRegistryAddr,
    // sanctioned countries: undefined ("1") + hash of USA + placeholders
    ['1', '20127816046968593389020923710838449693892100023326705503932851502896988843948', ...Array(18).fill('0')],
    [], // no investigation institutions
    0, // no age threshold
  ], { id: 'NonUSWrapper' });

  const nonUSDApp = module.contract('contracts/dapps/NonUSProverDApp.sol:NonUSProverDApp', [
    nonUSWrapper,
    nonUSSBT.uri,
    nonUSSBT.name,
    nonUSSBT.symbol,
  ]);

  // NonSanctionedJurisdiction verification setup
  const sanctionedCountriesHashes = [
    '1', // undefined
    '13369830695244779149456749754972838476616503669302012953188892797725043107673', // 'RUS'
    '17893540373022885423263203386830254068816468985113123133093470797653442012166', // 'BLR'
    '13234116648699046051033406700729289847632558216862093650885476830670844623765', // 'IRN'
    '16901951656398638655647948789024924938831629670968969998166725244901247901830', // 'PRK'
    '6598289298041825936653216089598074123659124008701976987610140084748598055097',  // 'SYR'
    '18162059728842977726516425524040024892227717816016893090139806299334194424550', // 'VEN'
    '13374754456027892993158547797574509509736503926430159554987593950773055306279', // 'CUB'
    '21030096903323302843227900542097100444395067988624103068124821127671734949423', // 'MMR'
    '11533725434476754399653652522899226987509265154077242334963936593671081764168', // 'LBY'
    '7606892906088765306862088090569802799264866749226766926459436838542994037297',  // 'SDN'
    '11994698654418157952439524006456093423554073924073059436734994844842893096999', // 'SSD'
    '15074825242542157616654734831433014425988162006426071725823968693020079583062', // 'YEM'
    '3987451906655659996823698397073414006700263398242903456806430106901733070648',  // 'SOM'
    '19549877999900639069064825074522649633777987924996607951506027695398624058628', // 'COD'
    '15618717698067068915421459736436123406734076529866688481969528318527816075463', // 'CAF'
    ...Array(4).fill('0') // placeholders
  ];

  const nonSanctionedJurisdictionWrapper = module.contract('AgeCitizenshipKYC', [
    deployer,
    zkpVerifier,
    recordRegistryAddr,
    sanctionedCountriesHashes,
    [], // no investigation institutions
    0, // no age threshold
  ], { id: 'NonSanctionedWrapper' });

  const nonSanctionedJurisdictionDApp = module.contract('contracts/dapps/NonSanctionedProverDApp.sol:NonSanctionedProverDApp', [
    nonSanctionedJurisdictionWrapper,
    nonSanctionedSBT.uri,
    nonSanctionedSBT.name,
    nonSanctionedSBT.symbol,
  ]);

  // Adult18Plus verification setup
  const adult18PlusWrapper = module.contract('AgeCitizenshipKYC', [
    deployer,
    zkpVerifier,
    recordRegistryAddr,
    ['1', ...Array(19).fill('0')], // no sanctioned countries
    [], // no investigation institutions
    18, // age threshold
  ], { id: 'Adult18PlusWrapper' });

  const adult18PlusDApp = module.contract('contracts/dapps/Age18ProverDApp.sol:Age18ProverDApp', [
    adult18PlusWrapper,
    age18SBT.uri,
    age18SBT.name,
    age18SBT.symbol,
  ]);

  return {
    zkpVerifier,
    nonUS: {
      ageCitizenshipKYC: nonUSWrapper,
      dApp: nonUSDApp,
    },
    nonSanctionedJurisdiction: {
      ageCitizenshipKYC: nonSanctionedJurisdictionWrapper,
      dApp: nonSanctionedJurisdictionDApp,
    },
    adult18Plus: {
      ageCitizenshipKYC: adult18PlusWrapper,
      dApp: adult18PlusDApp,
    },
  };
});

export default KYCComplianceProofsModule;