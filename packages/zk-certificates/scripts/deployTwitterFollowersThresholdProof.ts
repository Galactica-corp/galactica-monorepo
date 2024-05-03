/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { buildEddsa, poseidonContract } from 'circomlibjs';
import { ethers, network } from 'hardhat';

import { deploySC } from '../lib/hardhatHelpers';
import { overwriteArtifact } from '../lib/helpers';
import { getEddsaKeyFromEthSigner } from '../lib/keyManagement';

/**
 * Deploys a contract that everyone can use to submit encrypted Data for on-chain storage.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    `Deploying contracts with account ${deployer.address} on network ${network.name}`,
  );

  console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  const deployGuardianRegistryFlag = false;
  const setGuardianFlag = false;
  const deployTwitterZkCertificateRegistryFlag = false;
  const deployTwitterFollowersCountProofVerifierFlag = false;
  const deployTwitterFollowersCountProofFlag = true;

  // Deploy the guardian registry if necessary
  let guardianRegistry;
  if (deployGuardianRegistryFlag) {
    const description = 'GuardianRegistry';
    guardianRegistry = await deploySC('GuardianRegistry', true, {}, [
      description,
    ]);
<<<<<<< HEAD
=======

>>>>>>> 6813e49 (remove redundant mapping)
  } else {
    const guardianRegistryAddress =
      '0x2B943d59498BC1759505bFa4CA78E12D7704f75D';
    guardianRegistry = await ethers.getContractAt(
      'GuardianRegistry',
      guardianRegistryAddress,
    );
    const description = await guardianRegistry.description();
    console.log(
      `use an existing guardian ${description} at ${guardianRegistryAddress}`,
    );
  }

  // grant the deployer guardian role if necessary
  const guardianName = 'Galactica Test Guardian';
  const eddsa = await buildEddsa();
  const privKey = await getEddsaKeyFromEthSigner(deployer);
  const guardianPubKey = eddsa.prv2pub(privKey);
  const guardianAddress = deployer.address;
  if (setGuardianFlag) {
    console.log(`setting guardian ${guardianAddress}`);
    const setGuardianTx = await guardianRegistry.grantGuardianRole(
      guardianAddress,
      guardianPubKey,
      guardianName,
    );
    await setGuardianTx.wait(5);
  } else {
    const isGuardian = await guardianRegistry.isWhitelisted(guardianAddress);
    console.log(
      `Guardian ${guardianAddress} is ${isGuardian ? 'a' : 'not a'} guardian`,
    );
  }

  // Deploy the twitterZkCertificate registry if necessary
  let twitterZkCertificateRegistry;
  if (deployTwitterZkCertificateRegistryFlag) {
    await overwriteArtifact(hre, 'PoseidonT3', poseidonContract.createCode(2));
    const poseidonT3 = await deploySC('PoseidonT3', false);

    const description = 'TwitterZkCertificateRegistry';
    twitterZkCertificateRegistry = await deploySC(
      'ZkCertificateRegistry',
      true,
      { libraries: { PoseidonT3: poseidonT3.address } },
      [guardianRegistry.address, description],
    );
    console.log(
      `deployed a new twitterZkCertificate registry with description ${description} at ${twitterZkCertificateRegistry.address}`,
    );
  } else {
    const twitterZkCertificateRegistryAddress =
      '0xFa74c5025EaCC1CE76c90a19fF479e7135d3ccAA';
    twitterZkCertificateRegistry = await ethers.getContractAt(
      'ZkCertificateRegistry',
      twitterZkCertificateRegistryAddress,
    );
    const description = await twitterZkCertificateRegistry.description();
    console.log(
      `use an existing twitterZkCertificateRegistry ${description} at ${twitterZkCertificateRegistryAddress}`,
    );
  }

  // deploy the twitterFollowersCountProofVerifier if necessary
  let twitterFollowersCountProofVerifier;
  if (deployTwitterFollowersCountProofVerifierFlag) {
    twitterFollowersCountProofVerifier = await deploySC(
      'TwitterFollowersCountProofVerifier',
      true,
      {},
      [],
    );
    console.log(
      `deployed a new twitterFollowersCountProofVerifier at ${twitterFollowersCountProofVerifier.address}`,
    );
  } else {
    const twitterFollowersCountProofVerifierAddress =
      '0xBD05E41c748b6065C76F5A5B8E5C061C74Fe1F01';
    twitterFollowersCountProofVerifier = await ethers.getContractAt(
      'TwitterFollowersCountProofVerifier',
      twitterFollowersCountProofVerifierAddress,
    );
    console.log(
      `use an existing twitterFollowersCountProofVerifier at ${twitterFollowersCountProofVerifierAddress}`,
    );
  }

  // deploy the twitterFollowersCountProof if necessary
  let twitterFollowersCountProof;
  if (deployTwitterFollowersCountProofFlag) {
    twitterFollowersCountProof = await deploySC(
      'TwitterFollowersCountProof',
      true,
      {},
      [
        deployer.address,
        twitterFollowersCountProofVerifier.address,
        twitterZkCertificateRegistry.address,
      ],
    );
    console.log(
      `deployed a new twitterFollowersCountProof at ${twitterFollowersCountProof.address}`,
    );
  } else {
    const twitterFollowersCountProofAddress =
      '0x172cb6C095A3708c4F5f424f3f5d170cf8556A1D';
    twitterFollowersCountProof = await ethers.getContractAt(
      'TwitterFollowersCountProof',
      twitterFollowersCountProofAddress,
    );
    console.log(
      `use an existing twitterFollowersCountProof at ${twitterFollowersCountProofAddress}`,
    );
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
