/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import chalk from "chalk";

import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { string } from 'hardhat/internal/core/params/argumentTypes';

import { buildPoseidon } from "circomlibjs";

import { fromDecToHex, fromHexToBytes32 } from "../lib/helpers";
import { SparseMerkleTree } from "../lib/sparseMerkleTree";
import { queryOnChainLeaves } from "../lib/queryMerkleTree";

import { KYCRecordRegistry } from '../typechain-types/contracts/KYCRecordRegistry';
import { KYCCenterRegistry } from '../typechain-types/contracts/KYCCenterRegistry';


/**
 * @description Script for revoking a zkKYC certificate, issuing it and adding a merkle proof for it.
 * @param args See task definition below or 'npx hardhat createZkKYC --help'
 */
async function main(args: any, hre: HardhatRuntimeEnvironment) {
  console.log("Revoking zkKYC certificate");

  const [provider] = await hre.ethers.getSigners();
  console.log(`Using provider ${chalk.yellow(provider.address.toString())} to revoke the zkKYC certificate`);

  if (args.registryAddress === undefined) {
    console.log(chalk.yellow("Parameter 'registry-address' is missing. The zkKYC has not been issued on chain"));
    return;
  }

  console.log("Revoking zkKYC...");
  const recordRegistry = await hre.ethers.getContractAt('KYCRecordRegistry', args.registryAddress) as KYCRecordRegistry;
  const guardianRegistry = await hre.ethers.getContractAt('KYCCenterRegistry', await recordRegistry._KYCCenterRegistry()) as KYCCenterRegistry;

  if (!(await guardianRegistry.KYCCenters(provider.address))) {
    throw new Error(`Provider ${provider.address} is not a guardian yet. Please register it first using the script .`);
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
  for (let i = 0; i < leafLogResults.length; i += batchSize) {
    merkleTree.insertLeaves(leafHashes.slice(i, i + batchSize), leafIndices.slice(i, i + batchSize));
  }

  if (merkleTree.retrieveLeaf(0, args.index) !== args.leafHash) {
    console.log(chalk.yellow("Incorrect leaf hash at the input index."));
    return;
  }

  // create Merkle proof
  const merkleProof = merkleTree.createProof(args.index);

  // now we have the merkle proof to add a new leaf
  let tx = await recordRegistry.revokeZkKYCRecord(args.index, fromDecToHex(args.leafHash, true), merkleProof.path.map(x => fromHexToBytes32(fromDecToHex(x))));
  await tx.wait();
  console.log(chalk.green(`Revoked the zkKYC certificate ${args.leafHash} on chain at index ${args.index}`));

  console.log(chalk.green("done"));
}

task("revokeZkKYC", "Task to revoke a zkKYC certificate with leaf hash and merkle tree")
  .addParam("leafHash", "leaf hash of the zkKYC record in the merkle tree", undefined, string, false)
  .addParam("index", "index of the leaf in the merkle tree", 0, types.int, true)
  .addParam("registryAddress", "The smart contract address where zkKYCs are registered", undefined, types.string, true)
  .setAction(async (taskArgs, hre) => {
    await main(taskArgs, hre).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });

