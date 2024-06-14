/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import fs from 'fs';
import hre from 'hardhat';
import path from 'path';

import { deployBasicKYCExampleDApp } from './deploymentSteps/basicKYCExampleDApp';
import { deployDevnetGuardian } from './deploymentSteps/devnetGuardian';
import { deployExampleDApp } from './deploymentSteps/exampleDApp';
import { deployInfrastructure } from './deploymentSteps/infrastructure';
import { deployRepeatableZKPTest } from './deploymentSteps/repeatableZKPTest';
import { whitelistGuardian } from './deploymentSteps/whitelistGuardian';

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
    await infrastructure.verificationSBT.getAddress(),
    await infrastructure.ageProofZkKYC.getAddress(),
  );
  const repeatableZkKYC = await deployRepeatableZKPTest(
    deployer,
    await infrastructure.verificationSBT.getAddress(),
    await infrastructure.recordRegistry.getAddress(),
  );
  const basicKYCExample = await deployBasicKYCExampleDApp(
    deployer,
    await infrastructure.verificationSBT.getAddress(),
    await repeatableZkKYC.zkKYCSC.getAddress(),
  );
  const devnetGuardian = await deployDevnetGuardian(
    deployer,
    await infrastructure.guardianRegistry.getAddress(),
    await infrastructure.recordRegistry.getAddress(),
  );

  await whitelistGuardian(
    deployer,
    await infrastructure.guardianRegistry.getAddress(),
    deployer,
    'Galactica Test Guardian',
  );

  const deploymentSummary = `Deployment summary:
PoseidonT3: ${JSON.stringify(infrastructure.poseidonT3.getAddress())}

KYCGuardianRegistry: ${JSON.stringify(await infrastructure.guardianRegistry.getAddress())}
KYCRecordRegistry: ${JSON.stringify(await infrastructure.recordRegistry.getAddress())}
VerificationSBT: ${JSON.stringify(await infrastructure.verificationSBT.getAddress())}

MockGalacticaInstitution1: ${JSON.stringify(
    await infrastructure.institutionContracts[0].getAddress(),
  )}
MockGalacticaInstitution2: ${JSON.stringify(
    await infrastructure.institutionContracts[1].getAddress(),
  )}
MockGalacticaInstitution3: ${JSON.stringify(
    await infrastructure.institutionContracts[2].getAddress(),
  )}

ZkKYCVerifier: ${JSON.stringify(await repeatableZkKYC.zkKYCVerifier.getAddress())}
ZkKYC: ${JSON.stringify(await repeatableZkKYC.zkKYCSC.getAddress())}

ExampleMockDAppVerifier: ${JSON.stringify(await infrastructure.zkpVerifier.getAddress())}
AgeProofZkKYC: ${JSON.stringify(await infrastructure.ageProofZkKYC.getAddress())}
MockDApp: ${JSON.stringify(await exampleDApp.mockDApp.getAddress())}

BasicKYCExampleDApp: ${JSON.stringify(await basicKYCExample.getAddress())}
RepeatableZKPTest: ${JSON.stringify(await repeatableZkKYC.repeatableZKPTest.getAddress())}

DevnetGuardian: ${JSON.stringify(await devnetGuardian.getAddress())}
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
