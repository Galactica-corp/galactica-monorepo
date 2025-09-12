/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';

import type { MockZkCertificateRegistry } from '../../typechain-types';

/**
 * Script for adding a merkle root to the mock registry so that we can test cross-chain replication.
 */
async function main() {
  // parameters
  const mockRegistryAddr = '0x52c985CA1fa41Ca36bebe543cbb5dC93219252C3';
  const amountOfRootsToSet = 100;
  const merkleRootValidIndex = 10;
  const currentQueuePointer = 102;

  const mockRegistry = (await ethers.getContractAt(
    'MockZkCertificateRegistry',
    mockRegistryAddr,
  )) as unknown as MockZkCertificateRegistry;

  for (let i = 0; i < amountOfRootsToSet; i++) {
    console.log(`Setting merkle root ${i}`);
    await mockRegistry.setMerkleRoot(ethers.keccak256(ethers.toUtf8Bytes(`root-${i}`)));
  }
  console.log(`Setting merkle root valid index ${merkleRootValidIndex}`);
  await mockRegistry.setMerkleRootValidIndex(merkleRootValidIndex);
  console.log(`Setting current queue pointer ${currentQueuePointer}`);
  await mockRegistry.setCurrentQueuePointer(currentQueuePointer);

  console.log('Merkle roots set');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
