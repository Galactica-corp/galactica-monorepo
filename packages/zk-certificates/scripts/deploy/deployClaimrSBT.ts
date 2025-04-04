/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers, network } from 'hardhat';

import { deploySC } from '../../lib/hardhatHelpers';

/**
 * Deploys a contract that everyone can use to submit encrypted Data for on-chain storage.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    `Deploying contracts with account ${deployer.address} on network ${network.name}`,
  );

  console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  /* const issuer = '0xD8fd391410FDEA9da4e899770860EaE2db09Deab'; */
  const uri =
    'https://quicknode.quicknode-ipfs.com/ipfs/QmamnStu3KuWVWDCYDeERSE62WWU5PsSTdZJrqqsBicomN';
  const signee = '0x333e271244f12351b6056130AEC894EB8AAf05C2';
  const nftName = 'Galactica Network Validator';
  const nftSymbol = 'GALAVAL';

  await deploySC('claimrSignedSBT', true, {}, [
    nftName,
    nftSymbol,
    uri,
    signee,
  ]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
