/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';


async function main() {
  const [user] = await ethers.getSigners();

  const stakingAddress = '0xC0F305b12a73c6c8c6fd0EE0459c93f5C73e1AB3';
  const staking = await ethers.getContractAt('Staking', stakingAddress);
  const stake = ethers.parseEther('0.000000000000000001');
  console.log(`removing stake for ${user.address} with ${stake} WGNET`);
  await staking.removeStakeWithWGNET(stake, ethers.parseEther('0.000000000000001'));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
