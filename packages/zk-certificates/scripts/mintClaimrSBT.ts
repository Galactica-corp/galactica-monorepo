/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers, network } from 'hardhat';

/**
 * Tests minting a claimrSBT for the deployer
 */
async function main() {
  const ClaimrSBTAddress = '0x4A42c8cc4821372a835496080476aA6c71719ed9';
  const token = "test";

  const [deployer] = await ethers.getSigners();

  console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  const claimrSBT = await ethers.getContractAt(
    'claimrSignedSBT',
    ClaimrSBTAddress,
  );

  // const packed = ethers.utils.solidityPack(['string'], [token]);
  // const messageHash = ethers.utils.keccak256(packed);
  let messageHash = ethers.utils.arrayify(ethers.utils.id(token));

  const signature = await deployer.signMessage(messageHash);

  const tx = await claimrSBT.mint(token, signature);

  await tx.wait();
  console.log('done');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
