/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import fs from 'fs';
import hre from 'hardhat';
import path from 'path';

import { deployBasicKYCExampleDApp } from './deploymentSteps/basicKYCExampleDApp';
import { deployExampleDApp } from './deploymentSteps/exampleDApp';
import { deployInfrastructure } from './deploymentSteps/infrastructure';
import { deployKYCComplianceProofsDApps } from './deploymentSteps/kycComplianceProofs';
import { deployKYCRequirementsDemoDApp } from './deploymentSteps/kycRequirementDemo';
import { deployRepeatableZKPTest } from './deploymentSteps/repeatableZKPTest';
import { whitelistSignerGuardian } from './deploymentSteps/whitelistGuardian';

/**
 * Script to deploy the whole infrastructure and test contracts.
 * It is basically a combination of the other deploy scripts.
 */
async function main() {
  // wallets
  const [deployer, institution1, institution2, institution3] =
    await hre.ethers.getSigners();

  const infrastructure = await deployInfrastructure(
    deployer,
    [institution1, institution2, institution3],
    32,
  );
  const exampleDApp = await deployExampleDApp(
    deployer,
    await infrastructure.recordRegistry.getAddress(),
    await Promise.all(
      infrastructure.institutionContracts.map(
        async (contract) => await contract.getAddress(),
      ),
    ),
    {
      uri: 'ipfs://QmX2EppfoPMNEMqf55CsTHJr1565UheAonDGb9w1bAW96z',
      name: 'Airdrop Example SBT',
      symbol: 'KYCDROP',
    },
  );
  const repeatableZkKYC = await deployRepeatableZKPTest(
    deployer,
    await infrastructure.recordRegistry.getAddress(),
    {
      uri: 'ipfs://QmVG5b34f8DHGnPZQwi1GD4NUXEVhh7bTub5SG6MPHvHz6',
      name: 'Repeatable KYC Verification SBT',
      symbol: 'KYCREP',
    },
  );
  const basicKYCExample = await deployBasicKYCExampleDApp(
    deployer,
    await repeatableZkKYC.zkKYCSC.getAddress(),
    {
      uri: 'ipfs://QmdYZJP26w8dXHvR9g5Bykw4Ziqvgrst6p9XesZeR1qa2R',
      name: 'KYC Verification SBT',
      symbol: 'KYCOK',
    },
  );

  await whitelistSignerGuardian(
    deployer,
    await infrastructure.guardianRegistry.getAddress(),
    deployer,
    'ipfs://QmbxKQbSU2kMRx3Q96JWFvezKVCKv8ik4twKg7SFktkrgx',
  );

  const kycRequirementsDemoContracts = await deployKYCRequirementsDemoDApp(
    deployer,
    await infrastructure.recordRegistry.getAddress(),
    {
      uri: 'ipfs://QmRXjRe3w6ZTbuf1yhanzkEcvyyB9HymkNf4NMQQk5pNpC',
      name: 'Compliance Demo Verification SBT',
      symbol: 'COMP',
    },
  );

  const kycComplianceProofs = await deployKYCComplianceProofsDApps(
    deployer,
    await infrastructure.recordRegistry.getAddress(),
    {
      uri: 'ipfs://Qmc7fCZDftWvgsPuW2kVALEdUWWWTq9oKTP3vUXpct6mgP',
      name: 'KYC Non-US Verification SBT',
      symbol: 'NONUS',
    },
    {
      uri: 'ipfs://QmcxfT4459adX7PX9j4D5AsSpe2o3ZtDN9YU9VHNzinowH',
      name: 'KYC Non-sanctioned citizenship Verification SBT',
      symbol: 'NONSAN',
    },
    {
      uri: 'ipfs://QmYiRsyQ3iEEVg7LUKS6E77pUbTnBoUHAXMG434bBu2Lp1',
      name: 'KYC 18+ Verification SBT',
      symbol: 'KYC18',
    },
  );

  const deploymentSummary = `Deployment summary:
PoseidonT3: ${JSON.stringify(await infrastructure.poseidonT3.getAddress())}

KYCGuardianRegistry: ${JSON.stringify(
    await infrastructure.guardianRegistry.getAddress(),
  )}
KYCRecordRegistry: ${JSON.stringify(
    await infrastructure.recordRegistry.getAddress(),
  )}

MockGalacticaInstitution1: ${JSON.stringify(
    await infrastructure.institutionContracts[0].getAddress(),
  )}
MockGalacticaInstitution2: ${JSON.stringify(
    await infrastructure.institutionContracts[1].getAddress(),
  )}
MockGalacticaInstitution3: ${JSON.stringify(
    await infrastructure.institutionContracts[2].getAddress(),
  )}

ZkKYCVerifier: ${JSON.stringify(
    await repeatableZkKYC.zkKYCVerifier.getAddress(),
  )}
ZkKYC: ${JSON.stringify(await repeatableZkKYC.zkKYCSC.getAddress())}

BasicKYCExampleDApp: ${JSON.stringify(await basicKYCExample.dApp.getAddress())}
BasicKYCExampleDApp-SBT: ${JSON.stringify(basicKYCExample.sbtAddr)}

RepeatableZKPTest: ${JSON.stringify(
    await repeatableZkKYC.repeatableZKPTest.getAddress(),
  )}
RepeatableZKPTest-SBT: ${JSON.stringify(
    repeatableZkKYC.repeatableZKPTest.sbtAddr,
  )}


ExampleAirdrop-ExampleMockDAppVerifier: ${JSON.stringify(
    await exampleDApp.zkpVerifier.getAddress(),
  )}
ExampleAirdrop-AgeCitizenshipKYC: ${JSON.stringify(
    await exampleDApp.ageCitizenshipKYC.getAddress(),
  )}
ExampleAirdrop-MockDApp: ${JSON.stringify(
    await exampleDApp.mockDApp.getAddress(),
  )}
ExampleAirdrop-SBT: ${JSON.stringify(exampleDApp.sbtAddr)}


KYCRequirementsDemo-DApp: ${JSON.stringify(
    await kycRequirementsDemoContracts.kycRequirementsDemoDApp.getAddress(),
  )}
KYCRequirementsDemo-CircomVerifier: ${JSON.stringify(
    await kycRequirementsDemoContracts.zkpVerifier.getAddress(),
  )}
KYCRequirementsDemo-AgeCitizenshipKYC: ${JSON.stringify(
    await kycRequirementsDemoContracts.ageCitizenshipKYC.getAddress(),
  )}
KYCRequirementsDemo-CompliantERC20: ${JSON.stringify(
    await kycRequirementsDemoContracts.compliantERC20.getAddress(),
  )}
KYCRequirementsDemo-SBT: ${JSON.stringify(kycRequirementsDemoContracts.sbtAddr)}


KYCComplianceProofs-ZKPVerifier: ${JSON.stringify(
    await kycComplianceProofs.zkpVerifier.getAddress(),
  )}
KYCComplianceProofs-NonUS-AgeCitizenshipKYC: ${JSON.stringify(
    await kycComplianceProofs.nonUS.ageCitizenshipKYC.getAddress(),
  )}
KYCComplianceProofs-NonUS-DApp: ${JSON.stringify(
    await kycComplianceProofs.nonUS.dApp.getAddress(),
  )}
KYCComplianceProofs-NonUS-SBT: ${JSON.stringify(
    kycComplianceProofs.nonUS.sbtAddr,
  )}
KYCComplianceProofs-NonSanctionedJurisdiction-AgeCitizenshipKYC: ${JSON.stringify(
    await kycComplianceProofs.nonSanctionedJurisdiction.ageCitizenshipKYC.getAddress(),
  )}
KYCComplianceProofs-NonSanctionedJurisdiction-DApp: ${JSON.stringify(
    await kycComplianceProofs.nonSanctionedJurisdiction.dApp.getAddress(),
  )}
KYCComplianceProofs-NonSanctionedJurisdiction-SBT: ${JSON.stringify(
    kycComplianceProofs.nonSanctionedJurisdiction.sbtAddr,
  )}
KYCComplianceProofs-Adult18Plus-AgeCitizenshipKYC: ${JSON.stringify(
    await kycComplianceProofs.adult18Plus.ageCitizenshipKYC.getAddress(),
  )}
KYCComplianceProofs-Adult18Plus-DApp: ${JSON.stringify(
    await kycComplianceProofs.adult18Plus.dApp.getAddress(),
  )}
KYCComplianceProofs-Adult18Plus-SBT: ${JSON.stringify(
    kycComplianceProofs.adult18Plus.sbtAddr,
  )}
  `;
  console.log(deploymentSummary);
  // write summary to file in deployments folder, create it if not existing already
  const dir = './deployments';
  // derive file name from date and time
  const filename = `${new Date().toISOString().replace(/:/gu, '-')}.txt`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  fs.writeFileSync(path.join(dir, filename), deploymentSummary);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
