/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from 'hardhat';

/**
 * Script for creating promo-codes.
 * Just modify the prefix to get different codes. It should be long enough so avoid brute force attacks.
 */
async function main() {
  const basePrefix = 'PutPrefixHere_';
  const amount = 1000;
  const length = 20;

  for (let i = 0; i < amount; i++) {
    const base = basePrefix + i.toString();
    const hash = ethers.keccak256(ethers.getBytes(base));
    const promoCode = hash.toUpperCase().slice(2, 2 + length);

    // To prevent frontrunning, we need to do a bit more than putting the verification code on chain.
    // Options are using a zk proof including the recipients address or redeeming the code off chain.
    // const verificationHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(promoCode));
    console.log(`${base}\t${promoCode}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
