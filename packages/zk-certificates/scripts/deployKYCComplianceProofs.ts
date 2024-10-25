/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import hre from 'hardhat';

import { deployKYCComplianceProofsDApps } from './deploymentSteps/kycComplianceProofs';

/**
 * Script to deploy the example DApp, a smart contract requiring zkKYC + age proof to airdrop tokens once to each user.
 */
async function main() {
  // parameters
  const zkKYCRecordRegistry = '0x68272A56A0e9b095E5606fDD8b6c297702C0dfe5';
  const nonUSSBT = {
    uri: 'ipfs://Qmeurn8qiGQF5CacFD4QnnHGMqTb4oNrDVJWC1SH3RaaU8',
    name: 'KYC Non-US Verification SBT',
    symbol: 'NONUS',
  };
  const nonSanctionedSBT = {
    uri: 'ipfs://Qmeu9GcAhTDkafd4RRqx22NkboerSiNdoXsjwoWPCBnAK8',
    name: 'KYC Non-sanctioned citizenship Verification SBT',
    symbol: 'NONSAN',
  };
  const age18SBT = {
    uri: 'ipfs://QmcS1oxPNs59cM3zuYP3uQbu95JoegnCZ3wHnBHyS9YPUS',
    name: 'KYC 18+ Verification SBT',
    symbol: 'KYC18',
  };

  // wallets
  const [deployer] = await hre.ethers.getSigners();

  await deployKYCComplianceProofsDApps(
    deployer,
    zkKYCRecordRegistry,
    nonUSSBT,
    nonSanctionedSBT,
    age18SBT,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
