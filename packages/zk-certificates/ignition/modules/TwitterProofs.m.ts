// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const TwitterProofsModule = buildModule('TwitterProofsModule', (module) => {
  // Get deployer account
  const deployer = module.getAccount(0);

  // Parameters
  const recordRegistryAddr = module.getParameter('recordRegistryAddr', '0xe262d4e095BAb2F6e32ED46C5bBec5Fe73f1a0eA');

  // SBT parameters with defaults
  const creationTimeBefore2020SBT = {
    uri: module.getParameter('creationTimeBefore2020Uri', 'ipfs://QmNQCnW9QTnveNHr9aNsGWsHz3HBkCZ7x2XzQ2wehAiyAh'),
    name: module.getParameter('creationTimeBefore2020Name', 'X created before 2020'),
    symbol: module.getParameter('creationTimeBefore2020Symbol', 'XOG'),
  };

  const creationTimeIn2024SBT = {
    uri: module.getParameter('creationTimeIn2024Uri', 'ipfs://QmWtncmCSLKJBmmpntrQbeMFpUyUJEPsASacQfaVCQJobr'),
    name: module.getParameter('creationTimeIn2024Name', 'X created in 2024'),
    symbol: module.getParameter('creationTimeIn2024Symbol', 'X2024'),
  };

  const followersCount100SBT = {
    uri: module.getParameter('followersCount100Uri', 'ipfs://Qmd8rVPsgdDa7ySCSnBbCYFFc6mGPzpX39rfLguWy8FQjQ'),
    name: module.getParameter('followersCount100Name', 'X 100 followers'),
    symbol: module.getParameter('followersCount100Symbol', 'X100F'),
  };

  const followersCount1kSBT = {
    uri: module.getParameter('followersCount1kUri', 'ipfs://QmTt81xC3z9ZaYBV35rQAr3QkMNQD3wA5GaKE2JGf3FFxc'),
    name: module.getParameter('followersCount1kName', 'X 1k followers'),
    symbol: module.getParameter('followersCount1kSymbol', 'X1K'),
  };

  const followersCount10kSBT = {
    uri: module.getParameter('followersCount10kUri', 'ipfs://QmVALCT5SmMwxbSVdc28RwtnTuTPSr6srUftQCRbJiPUxZ'),
    name: module.getParameter('followersCount10kName', 'X 10k followers'),
    symbol: module.getParameter('followersCount10kSymbol', 'X10K'),
  };

  // Deploy common SBTManager for Twitter proofs
  const dAppSBTManager = module.contract('SBTManager', [deployer]);

  // Deploy FollowersCount verifier and wrapper
  const zkpVerifierFollowersCount = module.contract('TwitterFollowersCountProofVerifier', []);

  const followersCountWrapper = module.contract('TwitterFollowersCountProof', [
    deployer,
    zkpVerifierFollowersCount,
    recordRegistryAddr,
  ]);

  // Deploy SBTs for Twitter followers count proof
  const followersCountSBT100 = module.contract('VerificationSBT', [
    followersCount100SBT.uri,
    followersCount100SBT.name,
    followersCount100SBT.symbol,
    dAppSBTManager,
  ]);

  const followersCountSBT1k = module.contract('VerificationSBT', [
    followersCount1kSBT.uri,
    followersCount1kSBT.name,
    followersCount1kSBT.symbol,
    dAppSBTManager,
  ]);

  const followersCountSBT10k = module.contract('VerificationSBT', [
    followersCount10kSBT.uri,
    followersCount10kSBT.name,
    followersCount10kSBT.symbol,
    dAppSBTManager,
  ]);

  // Configure SBTManager for followers count SBTs
  module.call(dAppSBTManager, 'setSBT', [0, followersCountSBT100], { id: 'SetSBT0' });
  module.call(dAppSBTManager, 'setVerifierWrapper', [0, followersCountWrapper], { id: 'SetVerifierWrapper0' });
  module.call(dAppSBTManager, 'setSBT', [1, followersCountSBT1k], { id: 'SetSBT1' });
  module.call(dAppSBTManager, 'setVerifierWrapper', [1, followersCountWrapper], { id: 'SetVerifierWrapper1' });
  module.call(dAppSBTManager, 'setSBT', [2, followersCountSBT10k], { id: 'SetSBT2' });
  module.call(dAppSBTManager, 'setVerifierWrapper', [2, followersCountWrapper], { id: 'SetVerifierWrapper2' });

  // Deploy CreationTime verifier and wrapper
  const zkpVerifierCreationTime = module.contract('TwitterCreationTimeProofVerifier', []);

  const creationTimeWrapper = module.contract('TwitterCreationTimeProof', [
    deployer,
    zkpVerifierCreationTime,
    recordRegistryAddr,
  ]);

  // Deploy SBTs for Twitter creation time proof
  const creationTimeSBTBefore2020 = module.contract('VerificationSBT', [
    creationTimeBefore2020SBT.uri,
    creationTimeBefore2020SBT.name,
    creationTimeBefore2020SBT.symbol,
    dAppSBTManager,
  ]);

  const creationTimeSBTIn2024 = module.contract('VerificationSBT', [
    creationTimeIn2024SBT.uri,
    creationTimeIn2024SBT.name,
    creationTimeIn2024SBT.symbol,
    dAppSBTManager,
  ]);

  // Configure SBTManager for creation time SBTs
  module.call(dAppSBTManager, 'setSBT', [3, creationTimeSBTBefore2020], { id: 'SetSBT3' });
  module.call(dAppSBTManager, 'setVerifierWrapper', [3, creationTimeWrapper], { id: 'SetVerifierWrapper3' });
  module.call(dAppSBTManager, 'setSBT', [4, creationTimeSBTIn2024], { id: 'SetSBT4' });
  module.call(dAppSBTManager, 'setVerifierWrapper', [4, creationTimeWrapper], { id: 'SetVerifierWrapper4' });

  return {
    dAppSBTManager,
    zkpVerifierFollowersCount,
    followersCountWrapper,
    followersCountSBT100,
    followersCountSBT1k,
    followersCountSBT10k,
    zkpVerifierCreationTime,
    creationTimeWrapper,
    creationTimeSBTBefore2020,
    creationTimeSBTIn2024,
  };
});

export default TwitterProofsModule;