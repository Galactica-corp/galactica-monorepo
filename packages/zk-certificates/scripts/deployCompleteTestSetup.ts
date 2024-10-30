/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import fs from 'fs';
import hre from 'hardhat';
import path from 'path';

import { deployBasicKYCExampleDApp } from './deploymentSteps/basicKYCExampleDApp';
import { deployDevnetGuardian } from './deploymentSteps/devnetGuardian';
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
    infrastructure.verificationSBT.address,
    infrastructure.recordRegistry.address,
    infrastructure.institutionContracts.map((contract) => contract.address),
  );
  const repeatableZkKYC = await deployRepeatableZKPTest(
    deployer,
    infrastructure.verificationSBT.address,
    infrastructure.recordRegistry.address,
  );
  const basicKYCExample = await deployBasicKYCExampleDApp(
    deployer,
    infrastructure.verificationSBT.address,
    repeatableZkKYC.zkKYCSC.address,
  );
  const devnetGuardian = await deployDevnetGuardian(
    deployer,
    infrastructure.guardianRegistry.address,
    infrastructure.recordRegistry.address,
  );

  await whitelistSignerGuardian(
    deployer,
    infrastructure.guardianRegistry.address,
    deployer,
    'ipfs://QmbxKQbSU2kMRx3Q96JWFvezKVCKv8ik4twKg7SFktkrgx',
  );

  const kycRequirementsDemoContracts = await deployKYCRequirementsDemoDApp(
    deployer,
    infrastructure.recordRegistry.address,
    infrastructure.verificationSBT.address,
  );

  const kycComplianceProofs = await deployKYCComplianceProofsDApps(
    deployer,
    infrastructure.recordRegistry.address,
    infrastructure.verificationSBT.address,
  );

  const deploymentSummary = `Deployment summary:
PoseidonT3: ${JSON.stringify(infrastructure.poseidonT3.address)}

KYCGuardianRegistry: ${JSON.stringify(infrastructure.guardianRegistry.address)}
KYCRecordRegistry: ${JSON.stringify(infrastructure.recordRegistry.address)}
VerificationSBT: ${JSON.stringify(infrastructure.verificationSBT.address)}

MockGalacticaInstitution1: ${JSON.stringify(
    infrastructure.institutionContracts[0].address,
  )}
MockGalacticaInstitution2: ${JSON.stringify(
    infrastructure.institutionContracts[1].address,
  )}
MockGalacticaInstitution3: ${JSON.stringify(
    infrastructure.institutionContracts[2].address,
  )}

ZkKYCVerifier: ${JSON.stringify(repeatableZkKYC.zkKYCVerifier.address)}
ZkKYC: ${JSON.stringify(repeatableZkKYC.zkKYCSC.address)}


BasicKYCExampleDApp: ${JSON.stringify(basicKYCExample.address)}
RepeatableZKPTest: ${JSON.stringify(repeatableZkKYC.repeatableZKPTest.address)}

DevnetGuardian: ${JSON.stringify(devnetGuardian.address)}


ExampleAirdrop-ExampleMockDAppVerifier: ${JSON.stringify(
    exampleDApp.zkpVerifier.address,
  )}
ExampleAirdrop-AgeCitizenshipKYC: ${JSON.stringify(
    exampleDApp.ageCitizenshipKYC.address,
  )}
ExampleAirdrop-MockDApp: ${JSON.stringify(exampleDApp.mockDApp.address)}


KYCRequirementsDemo-DApp: ${JSON.stringify(
    kycRequirementsDemoContracts.kycRequirementsDemoDApp.address,
  )}
KYCRequirementsDemo-CircomVerifier: ${JSON.stringify(
    kycRequirementsDemoContracts.zkpVerifier.address,
  )}
KYCRequirementsDemo-AgeCitizenshipKYC: ${JSON.stringify(
    kycRequirementsDemoContracts.ageCitizenshipKYC.address,
  )}
KYCRequirementsDemo-CompliantERC20: ${JSON.stringify(
    kycRequirementsDemoContracts.compliantERC20.address,
  )}


KYCComplianceProofs-ZKPVerifier: ${JSON.stringify(
    kycComplianceProofs.zkpVerifier.address,
  )}
KYCComplianceProofs-NonUS-AgeCitizenshipKYC: ${JSON.stringify(
    kycComplianceProofs.nonUS.ageCitizenshipKYC.address,
  )}
KYCComplianceProofs-NonUS-BasicKYCExampleDApp: ${JSON.stringify(
    kycComplianceProofs.nonUS.basicExampleDApp.address,
  )}
KYCComplianceProofs-NonSanctionedJurisdiction-AgeCitizenshipKYC: ${JSON.stringify(
    kycComplianceProofs.nonSanctionedJurisdiction.ageCitizenshipKYC.address,
  )}
KYCComplianceProofs-NonSanctionedJurisdiction-BasicKYCExampleDApp: ${JSON.stringify(
    kycComplianceProofs.nonSanctionedJurisdiction.basicExampleDApp.address,
  )}
KYCComplianceProofs-Adult18Plus-AgeCitizenshipKYC: ${JSON.stringify(
    kycComplianceProofs.adult18Plus.ageCitizenshipKYC.address,
  )}
KYCComplianceProofs-Adult18Plus-BasicKYCExampleDApp: ${JSON.stringify(
    kycComplianceProofs.adult18Plus.basicExampleDApp.address,
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
