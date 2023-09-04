/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import fs from 'fs'
import path from 'path';
import chalk from "chalk";

import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { string } from 'hardhat/internal/core/params/argumentTypes';

import { buildEddsa, buildPoseidon } from "circomlibjs";

import { ZKCertificate } from "../lib/zkCertificate";
import { getEddsaKeyFromEthSigner } from "../lib/keyManagement";
import { fromDecToHex, fromHexToBytes32, hashStringToFieldNumber } from "../lib/helpers";
import { MerkleTree } from "../lib/merkleTree";
import { queryOnChainLeaves } from "../lib/queryMerkleTree";

import { KYCRecordRegistry } from '../typechain-types/contracts/KYCRecordRegistry';
import { KYCCenterRegistry } from '../typechain-types/contracts/KYCCenterRegistry';
import { ZkCertStandard, zkKYCContentFields } from '@galactica-net/galactica-types';


/**
 * @description Script for creating a zkKYC certificate, issuing it and adding a merkle proof for it.
 * @param args See task definition below or 'npx hardhat createZkKYC --help'
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  console.log("Creating zkKYC certificate");

  const [provider] = await hre.ethers.getSigners();
  console.log(`Using provider ${chalk.yellow(provider.address.toString())} to sign the zkKYC certificate`);

  console.log("holderCommitment", args.holderCommitment);
  console.log("randomSalt", args.randomSalt);

  console.log(`reading KYC data from ${args.kycDataFile}`);
  let data = JSON.parse(fs.readFileSync(args.kycDataFile, 'utf-8'))
  console.log("input data", data);

  const eddsa = await buildEddsa();

  //verify that all the fields are present
  const exceptions = [
    "holderCommitment",
  ];
  const stringFieldsForHashing = [ // TODO: standardize the definition of fields and which of those are hashed and read it from the standard instead of hardcoding it here
    "surname",
    "forename",
    "middlename",
    "streetAndNumber",
    "postcode",
    "town",
    "region",
    "country",
    "citizenship",
    "passportID",
  ];
  const zkKYCFields: Record<string, any> = {};
  for (let field of zkKYCContentFields.filter((field) => !exceptions.includes(field))) {
    if (data[field] === undefined) {
      throw new Error(`Field ${field} missing in KYC data`);
    }
    if (stringFieldsForHashing.includes(field)) {
      // hashing string data so that it fits into the field used by the circuit
      zkKYCFields[field] = hashStringToFieldNumber(data[field], eddsa.poseidon);
    }
    else {
      zkKYCFields[field] = data[field];
    }
  }

  console.log("Creating zkKYC...");
  // TODO: create ZkKYC subclass requiring all the other fields
  let zkKYC = new ZKCertificate(args.holderCommitment, ZkCertStandard.zkKYC, eddsa, args.randomSalt, zkKYCFields);

  // let provider sign the zkKYC
  const providerEdDSAKey = await getEddsaKeyFromEthSigner(provider);
  zkKYC.signWithProvider(providerEdDSAKey);
  console.log(chalk.green(`created the zkKYC certificate ${zkKYC.did}`));
  console.log(chalk.green(`Leaf Hash: ${zkKYC.leafHash}`));

  if (args.registryAddress === undefined) {
    console.log("zkKYC", zkKYC.exportJson());
    console.log(chalk.yellow("Parameter 'registry-address' is missing. The zkKYC has not been issued on chain"));
    return;
  }

  console.log("Issuing zkKYC...");
  const recordRegistry = await hre.ethers.getContractAt('KYCRecordRegistry', args.registryAddress) as KYCRecordRegistry;
  const guardianRegistry = await hre.ethers.getContractAt('KYCCenterRegistry', await recordRegistry._KYCCenterRegistry()) as KYCCenterRegistry;

  if (!(await guardianRegistry.KYCCenters(provider.address))) {
    throw new Error(`Provider ${provider.address} is not a guardian yet. Please register it first using the script .`);
  }
  const leafBytes = fromHexToBytes32(fromDecToHex(zkKYC.leafHash));
  let tx = await recordRegistry.addZkKYCRecord(leafBytes);
  await tx.wait();
  console.log(chalk.green(`Issued the zkKYC certificate ${zkKYC.did} on chain`));

  if (!args.merkleProof) {
    console.log("zkKYC", zkKYC.exportJson());
    console.log(chalk.yellow("Merkle proof generation is disabled. Before using the zkKYC, you need to generate the merkle proof."));
    return;
  }

  console.log("Generating merkle proof. This might take a while because it needs to query on-chain data...");
  // Note for developers: The slow part of building the Merkle tree can be skipped if you build a back-end service maintaining an updated Merkle tree
  const poseidon = await buildPoseidon();
  const merkleDepth = 32;
  const leaves = await queryOnChainLeaves(hre.ethers, recordRegistry.address); // TODO: provide first block to start querying from to speed this up
  const merkleTree = new MerkleTree(merkleDepth, poseidon);
  const batchSize = 10_000;
  for (let i = 0; i < leaves.length; i += batchSize) {
    merkleTree.insertLeaves(leaves.slice(i, i + batchSize));
  }

  // create Merkle proof
  const merkleProof = merkleTree.createProof(zkKYC.leafHash);
  let output = zkKYC.export();
  output.merkleProof = {
    root: merkleTree.root,
    pathIndices: merkleProof.pathIndices,
    pathElements: merkleProof.pathElements,
  }

  console.log(chalk.green("ZkKYC (created, issued, including merkle proof)"));
  console.log(zkKYC.exportJson());
  console.log(chalk.green("This ZkKYC can be imported in a wallet"));

  // write output to file
  const outputFileName = args.outputFile || `issuedZkKYCs/${zkKYC.leafHash}.json`;
  fs.mkdirSync(path.dirname(outputFileName), { recursive: true });
  fs.writeFileSync(outputFileName, JSON.stringify(output, null, 2));
  console.log(chalk.green(`Written ZkKYC to output file ${outputFileName}`));

  console.log(chalk.green("done"));
}

task("createZkKYC", "Task to create a zkKYC certificate with input parameters")
  .addParam("holderCommitment", "The holder commitment fixing the address of the holder without disclosing it to the provider", undefined, string, false)
  .addParam("randomSalt", "Random salt to input into zkCert hashing", 0, types.int, true)
  .addParam("kycDataFile", "The file containing the KYC data", undefined, types.string, false)
  .addParam("registryAddress", "The smart contract address where zkKYCs are registered", undefined, types.string, true)
  .addParam("merkleProof", "Should the script also create a merkle proof?", true, types.boolean, true)
  .addParam("outputFile", "Where to write the result JSON file to?", undefined, types.string, true)
  .setAction(async (taskArgs, hre) => {
    await main(taskArgs, hre).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });

