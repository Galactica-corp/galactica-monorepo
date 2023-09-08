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
import { fromDecToHex, fromHexToBytes32, hashStringToFieldNumber, fromHexToDec } from "../lib/helpers";
import { SparseMerkleTree } from "../lib/sparseMerkleTree";
import { queryOnChainLeaves } from "../lib/queryMerkleTree";

import { KYCRecordRegistry } from '../typechain-types/contracts/KYCRecordRegistry';
import { KYCCenterRegistry } from '../typechain-types/contracts/KYCCenterRegistry';
import { ZkCertStandard, zkKYCContentFields } from '@galactica-net/galactica-types';


/**
 * @description Script for reissuing a zkKYC certificate with current time stamp and adding a new merkle proof for it.
 * @param args See task definition below or 'npx hardhat reissueZkKYC --help'
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

  console.log("Reissuing zkKYC...");
  const oldZkKYCFields = { ...zkKYCFields };
  oldZkKYCFields['expirationDate'] = args.oldExpirationDate;
  const newZkKYCFields = { ...zkKYCFields };
  newZkKYCFields['expirationDate'] = args.newExpirationDate;
  // TODO: create ZkKYC subclass requiring all the other fields
  let oldZkKYC = new ZKCertificate(args.holderCommitment, ZkCertStandard.zkKYC, eddsa, args.randomSalt, oldZkKYCFields);
  let newZkKYC = new ZKCertificate(args.holderCommitment, ZkCertStandard.zkKYC, eddsa, args.randomSalt, newZkKYCFields);

  // let provider sign the zkKYC
  const providerEdDSAKey = await getEddsaKeyFromEthSigner(provider);
  oldZkKYC.signWithProvider(providerEdDSAKey);
  newZkKYC.signWithProvider(providerEdDSAKey);

  if (args.registryAddress === undefined) {
    console.log(chalk.yellow("Parameter 'registry-address' is missing. The zkKYC has not been issued on chain"));
    return;
  }

  console.log("reissuing zkKYC...");
  const recordRegistry = await hre.ethers.getContractAt('KYCRecordRegistry', args.registryAddress) as KYCRecordRegistry;
  const guardianRegistry = await hre.ethers.getContractAt('KYCCenterRegistry', await recordRegistry._KYCCenterRegistry()) as KYCCenterRegistry;

  if (!(await guardianRegistry.KYCCenters(provider.address))) {
    throw new Error(`Provider ${provider.address} is not a guardian yet. Please register it first using the script .`);
  }
  const oldLeafBytes = fromHexToBytes32(fromDecToHex(oldZkKYC.leafHash));
  const newLeafBytes = fromHexToBytes32(fromDecToHex(newZkKYC.leafHash));

  if (!args.merkleProof) {
    console.log("zkKYC", newZkKYC.exportJson());
    console.log(chalk.yellow("Merkle proof generation is disabled. Before using the zkKYC, you need to generate the merkle proof."));
    return;
  }

  console.log("Generating merkle proof. This might take a while because it needs to query on-chain data...");
  // Note for developers: The slow part of building the Merkle tree can be skipped if you build a back-end service maintaining an updated Merkle tree
  const poseidon = await buildPoseidon();
  const merkleDepth = 32;
  const leafLogResults = await queryOnChainLeaves(hre.ethers, recordRegistry.address); // TODO: provide first block to start querying from to speed this up
  const leafHashes = leafLogResults.map(x => x.leafHash);
  const leafIndices = leafLogResults.map(x => Number(x.index));
  const merkleTree = new SparseMerkleTree(merkleDepth, poseidon);
  const batchSize = 10_000;
  console.log(`Adding leaves to the merkle tree`);
  for (let i = 0; i < leafLogResults.length; i += batchSize) {
    merkleTree.insertLeaves(leafHashes.slice(i, i + batchSize), leafIndices.slice(i, i + batchSize));
  }

  if (merkleTree.retrieveLeaf(0, args.index) !== fromHexToDec(oldLeafBytes)) {
    console.log(`the current leaf hash at index ${args.index} does not correspond with the outdated zkKYC Cert we want to update`);
    console.log(`current leaf hash at index ${args.index}: ${merkleTree.retrieveLeaf(0, args.index)}`);
    console.log(`outdated zkKYC Cert leaf hash: ${oldLeafBytes}`);
    return;
  }

  // now we update the tree by revoking the previous entry and adding a new one
  const oldMerkleProof = merkleTree.createProof(args.index);
  let tx = await recordRegistry.revokeZkKYCRecord(args.index, oldLeafBytes, oldMerkleProof.path.map(x => fromHexToBytes32(fromDecToHex(x))));
  await tx.wait();
  console.log(chalk.green(`revoked old zkKYC certificate ${oldZkKYC.did}`));

  merkleTree.insertLeaves([merkleTree.emptyLeaf], [args.index]);
  const emptiedMerkleProof = merkleTree.createProof(args.index);

  tx = await recordRegistry.addZkKYCRecord(args.index, newLeafBytes, emptiedMerkleProof.path.map(x => fromHexToBytes32(fromDecToHex(x))));
  await tx.wait();
  console.log(chalk.green(`reissued the zkKYC certificate ${newZkKYC.did} on chain at index ${args.index} with new expiration date ${args.newExpirationDate}`));
  console.log(chalk.green("ZkKYC (reissued, including merkle proof)"));

  console.log(newZkKYC.exportJson());
  console.log(chalk.green("This ZkKYC can be imported in a wallet"));

  // write output to file
  let output = newZkKYC.export();
  merkleTree.insertLeaves([newZkKYC.leafHash], [args.index]);
  const newMerkleProof = merkleTree.createProof(args.index);
  output.merkleProof = {
    root: merkleTree.root,
    pathIndices: newMerkleProof.pathIndices,
    pathElements: newMerkleProof.path,
  }
  const outputFileName = args.outputFile || `issuedZkKYCs/${newZkKYC.leafHash}.json`;
  fs.mkdirSync(path.dirname(outputFileName), { recursive: true });
  fs.writeFileSync(outputFileName, JSON.stringify(output, null, 2));
  console.log(chalk.green(`Written ZkKYC to output file ${outputFileName}`));

  console.log(chalk.green("done"));
}

task("reissueZkKYC", "Task to reissue a zkKYC certificate with later expiration date")
  .addParam("index", "index of the zkKYC certificate to be updated", 0, types.int, true)
  .addParam("oldExpirationDate", "old expiration date", 0, types.int, true)
  .addParam("newExpirationDate", "new expiration date", 0, types.int, true)
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

