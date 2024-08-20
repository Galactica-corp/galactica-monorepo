/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers, network } from 'hardhat';

import { deploySC } from '../lib/hardhatHelpers';

/**
 * Deploys a contract that everyone can use to submit encrypted Data for on-chain storage.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    `Deploying contracts with account ${deployer.address} on network ${network.name}`,
  );

  console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  let issuer = deployer.address;
  let owner = deployer.address;
  // type 1
  /* const uri =
    "https://quicknode.quicknode-ipfs.com/ipfs/QmTtA8dxzzcFqB9kaXwNMVVof83UiBJLyyTuMbuHNU2JHB";
  const nftName = 'Guilding Galactica - Participant';
  const nftSymbol = 'GGAL'; */

  // type 2
  /* const uri =
    "https://quicknode.quicknode-ipfs.com/ipfs/QmS8fB9NA6fJdwqEnhhVrESVhD5MEomWySofkdBBCjVQRH";
  const nftName = 'Guilding Galactica - Top 90';
  const nftSymbol = 'GG90';
 */

  // type 3
  /* const uri =
    "https://quicknode.quicknode-ipfs.com/ipfs/Qmdv8rvvPGh7uEHhUCSwREM152GoxjwrNNxLUmMiQwUnZP";
  const nftName = 'Guilding Galactica - Winning team';
  const nftSymbol = 'GGWIN'; */

  //type 4
  /* const uri =
    "https://quicknode.quicknode-ipfs.com/ipfs/QmeJS1PdjBtbE77xgez7uBuPWg8ByJm3eFQsEpE8ffSE5g";
  const nftName = 'Guilding Galactica - Top 10 (GG10)';
  const nftSymbol = 'GG10'; */

  //test type
  /* const uri =
    "https://mike-tis.github.io/XNET-SBT/content.json";
  const nftName = 'Test - Test';
  const nftSymbol = 'TTT'; */

  // test GalacticaTwitterSBT
  // const uri = "https://mike-tis.github.io/XNET-SBT/content.json";
  const uri = "https://quicknode.quicknode-ipfs.com/ipfs/QmeJS1PdjBtbE77xgez7uBuPWg8ByJm3eFQsEpE8ffSE5g";
  const nftName = "Genesis SBT";
  const nftSymbol = "XNET";

  /* const GalacticaOfficialSBTFactory = await ethers.getContractFactory('GalacticaTwitterSBT');
  const GalacticaOfficialSBT = await GalacticaOfficialSBTFactory.deploy(issuer, uri, owner, nftName, nftSymbol);
  await GalacticaOfficialSBT.deployed();

  console.log(`newly deployed SBT has address ${GalacticaOfficialSBT.address}`); */

  await deploySC('GalacticaTwitterSBT', true, {}, [
    issuer,
    uri,
    owner,
    nftName,
    nftSymbol,
  ]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
