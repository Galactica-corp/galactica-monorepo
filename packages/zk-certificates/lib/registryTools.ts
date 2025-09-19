/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import {
  KnownZkCertStandard,
  type ZkCertRegistration,
} from '@galactica-net/galactica-types';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { HardhatEthersHelpers } from '@nomicfoundation/hardhat-ethers/types';
import type { Provider } from 'ethers';

import { fromDecToHex, fromHexToBytes32 } from './helpers';
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
 * New flow: guardians enqueue an Add operation; a queue processor will update the Merkle tree.
 *
 * @param zkCert - ZkCertificate to issue on-chain.
 * @param recordRegistry - Record registry contract.
 * @param issuer - Issuer of the zkCert (guardian).
 * @param provider - Provider to use for the transaction.
 * @returns Registration data.
 */
export async function issueZkCert(
  zkCert: ZkCertificate,
  recordRegistry: ZkCertificateRegistry | ZkKYCRegistry,
  issuer: HardhatEthersSigner,
  provider: Provider,
): Promise<{ registration: ZkCertRegistration }> {
  const leafBytes = fromHexToBytes32(fromDecToHex(zkCert.leafHash));

  let tx;
  if (zkCert.zkCertStandard === KnownZkCertStandard.ZkKYC) {
    tx = await (recordRegistry as ZkKYCRegistry)
      .connect(issuer)
      .getFunction(
        'addOperationToQueue(bytes32,uint8,uint256,uint256,uint256)',
      )(
        leafBytes,
        0, // RegistryOperation.Add
        getIdHash(zkCert),
        zkCert.holderCommitment,
        zkCert.expirationDate,
      );
  } else {
    tx = await (recordRegistry as ZkCertificateRegistry)
      .connect(issuer)
      .addOperationToQueue(
        leafBytes,
        0, // RegistryOperation.Add
      );
  }

  await tx.wait();
  const txReceipt = await provider.getTransactionReceipt(tx.hash);
  if (txReceipt?.status !== 1) {
    throw Error('Transaction failed');
  }
  const queuePosition = await recordRegistry.getQueuePosition(leafBytes);

  return {
    registration: {
      address: await recordRegistry.getAddress(),
      chainID: Number((await provider.getNetwork()).chainId),
      revocable: true,
      queuePosition: Number(queuePosition),
    },
  };
}

/**
 * Revokes zkCert record on-chain and updates the merkle tree.
 * New flow: guardians enqueue a Revoke operation; a queue processor will update the Merkle tree.
 *
 * @param zkCertLeafHash - Leaf hash of the zkCert to revoke.
 * @param recordRegistry - Record registry contract.
 * @param issuer - Issuer of the zkCert (= guardian allowed to revoke).
 */
export async function revokeZkCert(
  zkCertLeafHash: string,
  recordRegistry: ZkCertificateRegistry | ZkKYCRegistry,
  issuer: HardhatEthersSigner,
) {
  const leafHashAsBytes = fromHexToBytes32(fromDecToHex(zkCertLeafHash));
  const tx = await (recordRegistry as any)
    .connect(issuer)
    .addOperationToQueue(leafHashAsBytes, 1); // RegistryOperation.Revoke
  await tx.wait();
}

/**
 * Checks if the zkCert holder commitment is compatible with the registered salt hash.
 *
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
  if (zkCert.zkCertStandard !== KnownZkCertStandard.ZkKYC) {
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
 *
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
  if (zkCert.zkCertStandard !== KnownZkCertStandard.ZkKYC) {
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
 *
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
  if (zkCert.zkCertStandard !== KnownZkCertStandard.ZkKYC) {
    throw new Error('Only ZkKYC can be checked for salt hash compatibility.');
  }
  const idHash = getIdHash(zkCert);

  const humanIDSaltRegistry = (await ethers.getContractAt(
    'HumanIDSaltRegistry',
    await recordRegistry.humanIDSaltRegistry(),
  )) as unknown as HumanIDSaltRegistry;

  await humanIDSaltRegistry.connect(issuer).resetSalt(idHash);
}
