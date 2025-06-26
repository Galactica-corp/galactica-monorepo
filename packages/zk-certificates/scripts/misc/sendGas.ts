/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import hre, { ethers } from 'hardhat';

/**
 * Script for creating promo-codes.
 * Just modify the prefix to get different codes. It should be long enough so avoid brute force attacks.
 */
async function main() {
  const [signer] = await hre.ethers.getSigners();

  const tx = await signer.sendTransaction({
    to: '0xdF30aAE275293FfE467BFc2276180dC48EA40F0d',
    value: ethers.parseEther('990000'),
  });

  await tx.wait();
  console.log('Transaction sent');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
