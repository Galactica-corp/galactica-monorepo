/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import {
  ZkCertStandard,
  type MerkleProof,
  type ZkCertRegistration,
} from '@galactica-net/galactica-types';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { HardhatEthersHelpers } from '@nomicfoundation/hardhat-ethers/types';
import type { Provider } from 'ethers';

import { fromDecToHex, fromHexToBytes32, sleep } from './helpers';
import type { SparseMerkleTree } from './sparseMerkleTree';
import type { ZkCertificate } from './zkCertificate';
import { getIdHash } from './zkKYC';
import type {
  HumanIDSaltRegistry,
  SaltLockingZkCertStruct,
} from '../typechain-types/contracts/HumanIDSaltRegistry';
import type { ZkCertificateRegistry } from '../typechain-types/contracts/ZkCertificateRegistry';
import type { ZkKYCRegistry } from '../typechain-types/contracts/ZkKYCRegistry';

/**
 * Issues zkCert record on-chain and updates the merkle tree.
 * @param zkCert - ZkCertificate to issue on-chain.
 * @param recordRegistry - Record registry contract.
 * @param issuer - Issuer of the zkCert (guardian).
 * @param merkleTree - Merkle tree of the registry (passed to not reconstruct it repeatedly).
 * @param provider - Provider to use for the transaction.
 * @returns MerkleProof of the new leaf in the tree and registration data.
 */
export async function issueZkCert(
  zkCert: ZkCertificate,
  recordRegistry: ZkCertificateRegistry | ZkKYCRegistry,
  issuer: HardhatEthersSigner,
  merkleTree: SparseMerkleTree,
  provider: Provider,
): Promise<{ merkleProof: MerkleProof; registration: ZkCertRegistration }> {
  const leafBytes = fromHexToBytes32(fromDecToHex(zkCert.leafHash));

  const chosenLeafIndex = merkleTree.getFreeLeafIndex();
  const leafEmptyMerkleProof = merkleTree.createProof(chosenLeafIndex);
  // now we have the merkle proof to add a new leaf

  let tx;
  // if the zkCert is a zkKYC, we need to pass a few more parameters for the salt registry
  if (zkCert.zkCertStandard === ZkCertStandard.ZkKYC) {
    tx = await (recordRegistry as ZkKYCRegistry).connect(issuer).addZkKYC(
      chosenLeafIndex,
      leafBytes,
      leafEmptyMerkleProof.pathElements.map((value) =>
        fromHexToBytes32(fromDecToHex(value)),
      ),
      getIdHash(zkCert),
      zkCert.holderCommitment,
      zkCert.expirationDate,
    );
  } else {
    tx = await (recordRegistry as ZkCertificateRegistry)
      .connect(issuer)
      .addZkCertificate(
        chosenLeafIndex,
        leafBytes,
        leafEmptyMerkleProof.pathElements.map((value) =>
          fromHexToBytes32(fromDecToHex(value)),
        ),
      );
  }

  await tx.wait();
  const txReceipt = await provider.getTransactionReceipt(tx.hash);
  if (txReceipt?.status !== 1) {
    throw Error('Transaction failed');
  }

  // update the merkle tree according to the new leaf
  merkleTree.insertLeaves([zkCert.leafHash], [chosenLeafIndex]);
  const leafInsertedMerkleProof = merkleTree.createProof(chosenLeafIndex);

  return {
    merkleProof: leafInsertedMerkleProof,
    registration: {
      address: await recordRegistry.getAddress(),
      chainID: Number((await provider.getNetwork()).chainId),
      revocable: true,
      leafIndex: chosenLeafIndex,
    },
  };
}

/**
 * Revokes zkCert record on-chain and updates the merkle tree.
 * @param zkCertLeafHash - Leaf hash of the zkCert to revoke.
 * @param leafIndex - Index of the zkCert to revoke.
 * @param recordRegistry - Record registry contract.
 * @param issuer - Issuer of the zkCert (= guardian allowed to revoke).
 * @param merkleTree - Merkle tree of the registry (passed to not reconstruct it repeatedly).
 */
export async function revokeZkCert(
  zkCertLeafHash: string,
  leafIndex: number,
  recordRegistry: ZkCertificateRegistry | ZkKYCRegistry,
  issuer: HardhatEthersSigner,
  merkleTree: SparseMerkleTree,
) {
  if (merkleTree.retrieveLeaf(0, leafIndex) !== zkCertLeafHash) {
    throw Error('Incorrect leaf hash at the input index.');
  }
  const leafHashAsBytes = fromHexToBytes32(fromDecToHex(zkCertLeafHash));
  if (
    (await recordRegistry.ZkCertificateToGuardian(leafHashAsBytes)) !==
    (await issuer.getAddress())
  ) {
    throw Error('Only the issuer of the zkCert can revoke it.');
  }

  const merkleProof = merkleTree.createProof(leafIndex);

  const tx = await recordRegistry.connect(issuer).revokeZkCertificate(
    leafIndex,
    leafHashAsBytes,
    merkleProof.pathElements.map((value) =>
      fromHexToBytes32(fromDecToHex(value)),
    ),
  );
  await tx.wait();
}

/**
 * Registers zkCert record in the on-chain queue for issuance.
 * @param zkCertLeafHash - Leaf hash of the zkCert to register.
 * @param recordRegistry - Record registry contract.
 * @param issuer - Issuer of the zkCert (= guardian allowed to register).
 * @returns Time parameters for zkCert issuance.
 */
export async function registerZkCertToQueue(
  zkCertLeafHash: string,
  recordRegistry: ZkCertificateRegistry | ZkKYCRegistry,
  issuer: HardhatEthersSigner,
) {
  const leafHashAsBytes = fromHexToBytes32(fromDecToHex(zkCertLeafHash));

  const tx = await recordRegistry
    .connect(issuer)
    .registerToQueue(leafHashAsBytes);
  await tx.wait();
}

/**
 * Waits for the queue until a zkCert can be issued.
 * @param recordRegistry - Record registry contract.
 * @param leafHash - Leaf hash of the zkCert.
 * @param provider - Provider to use for the transaction.
 */
export async function waitOnIssuanceQueue(
  recordRegistry: ZkCertificateRegistry | ZkKYCRegistry,
  leafHash: string,
  provider: Provider,
) {
  const leafHashAsBytes = fromHexToBytes32(fromDecToHex(leafHash));
  const [startTime, expirationTime] =
    await recordRegistry.getTimeParameters(leafHashAsBytes);

  const currentBlock = await provider.getBlockNumber();
  let lastBlockTime = (await provider.getBlock(currentBlock))?.timestamp ?? 0;

  console.log(
    `Waiting on zkCert registration queue.\n`,
    `Latest issuance start time: ${new Date(
      Number(startTime) * 1000,
    ).toLocaleString()}\n`,
    `Expiration time: ${new Date(
      Number(expirationTime) * 1000,
    ).toLocaleString()}`,
  );
  let earliestIssueTime = startTime;
  while (lastBlockTime < earliestIssueTime) {
    await sleep(10);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    [earliestIssueTime] =
      await recordRegistry.getTimeParameters(leafHashAsBytes);
    lastBlockTime = (await provider.getBlock(currentBlock))?.timestamp ?? 0;
    const queueLength =
      (await recordRegistry.ZkCertificateHashToIndexInQueue(leafHashAsBytes)) -
      (await recordRegistry.nextLeafIndex());
    console.log(
      `waiting for ${Number(queueLength) - 1} other zkCerts in the queue...`,
    );
  }
  console.log('Start time reached');
}

/**
 * Checks if the zkCert holder commitment is compatible with the registered salt hash.
 * @param zkCert - ZkCertificate to check.
 * @param recordRegistry - Record registry contract.
 * @param issuer - Issuer of the zkCert.
 * @param ethers - Ethers library from hre.
 * @returns If the check was successful.
 */
export async function checkZkKYCSaltHashCompatibility(
  zkCert: ZkCertificate,
  recordRegistry: ZkKYCRegistry,
  issuer: HardhatEthersSigner,
  ethers: HardhatEthersHelpers,
): Promise<boolean> {
  if (zkCert.zkCertStandard !== ZkCertStandard.ZkKYC) {
    throw new Error('Only ZkKYC can be checked for salt hash compatibility.');
  }
  const idHash = getIdHash(zkCert);
  const saltHash = zkCert.holderCommitment;

  const humanIDSaltRegistry = (await ethers.getContractAt(
    'HumanIDSaltRegistry',
    await recordRegistry.humanIDSaltRegistry(),
  )) as unknown as HumanIDSaltRegistry;

  const registeredSaltHash = await humanIDSaltRegistry
    .connect(issuer)
    .getSaltHash(idHash);

  return (
    registeredSaltHash.toString() === saltHash ||
    registeredSaltHash.toString() === '0'
  );
}

/**
 * Lists zkKYCs that lock the salt hash of the zkCert. If the user can not use the same commitment hash as before, the guardian can tell the user what zkKYCs need to expire or be revoked.
 * @param zkCert - ZkCertificate to check.
 * @param recordRegistry - Record registry contract.
 * @param issuer - Issuer of the zkCert.
 * @param ethers - Ethers library from hre.
 * @returns List of SaltLockingZkCerts.
 */
export async function listZkKYCsLockingTheSaltHash(
  zkCert: ZkCertificate,
  recordRegistry: ZkKYCRegistry,
  issuer: HardhatEthersSigner,
  ethers: HardhatEthersHelpers,
): Promise<SaltLockingZkCertStruct[]> {
  if (zkCert.zkCertStandard !== ZkCertStandard.ZkKYC) {
    throw new Error('Only ZkKYC can be checked for salt hash compatibility.');
  }
  const idHash = getIdHash(zkCert);

  const humanIDSaltRegistry = (await ethers.getContractAt(
    'HumanIDSaltRegistry',
    await recordRegistry.humanIDSaltRegistry(),
  )) as unknown as HumanIDSaltRegistry;

  return await humanIDSaltRegistry
    .connect(issuer)
    .getSaltLockingZkCerts(idHash);
}

/**
 * Resets the salt hash of a user.
 * @param zkCert - New ZkCertificate to be issued.
 * @param recordRegistry - Record registry contract.
 * @param issuer - Issuer of the zkCert.
 * @param ethers - Ethers library from hre.
 */
export async function resetSaltHash(
  zkCert: ZkCertificate,
  recordRegistry: ZkKYCRegistry,
  issuer: HardhatEthersSigner,
  ethers: HardhatEthersHelpers,
) {
  if (zkCert.zkCertStandard !== ZkCertStandard.ZkKYC) {
    throw new Error('Only ZkKYC can be checked for salt hash compatibility.');
  }
  const idHash = getIdHash(zkCert);

  const humanIDSaltRegistry = (await ethers.getContractAt(
    'HumanIDSaltRegistry',
    await recordRegistry.humanIDSaltRegistry(),
  )) as unknown as HumanIDSaltRegistry;

  await humanIDSaltRegistry.connect(issuer).resetSalt(idHash);
}
