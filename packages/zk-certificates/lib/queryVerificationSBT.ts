/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import type { IVerificationSBT } from '../typechain-types/contracts/interfaces/IVerificationSBT';

/**
 * Finds verification SBTs for a user. Searches through logs of created verificationSBTs
 * and filters according to the userAddr, dAppAddr, and humanID provided.
 * @param sbtContractAddrs - List of addresses of the verification SBTs contract holding completed verifications.
 * @param userAddr - Address of the user to find verification SBTs for (default: undefined).
 * @param humanID - HumanID of the user the SBT was created for (default: undefined).
 * @param filterExpiration - Whether to filter out expired SBTs (default: false).
 * @returns Map of verification SBTs (address of sbt contract => verification SBT data).
 */
export async function queryVerificationSBTs(
  sbtContractAddrs: string[],
  userAddr: string | undefined = undefined,
  humanID: string | undefined = undefined,
  filterExpiration = false,
): Promise<Map<string, IVerificationSBT.VerificationSBTInfoStruct[]>> {
  const factory = await ethers.getContractFactory('VerificationSBT');

  const currentBlock = await ethers.provider.getBlockNumber();
  const lastBlockTime = (await ethers.provider.getBlock(currentBlock))
    .timestamp;
  const sbtListRes = new Map<
    string,
    IVerificationSBT.VerificationSBTInfoStruct[]
  >();

  for (const sbtContractAddr of sbtContractAddrs) {
    const sbtContract = factory.attach(sbtContractAddr);

    // go through all logs adding a verification SBT for the user
    const createStakeLogs = await sbtContract.queryFilter(
      sbtContract.filters.VerificationSBTMinted(userAddr, humanID),
    );

    for (const log of createStakeLogs) {
      if (log.args === undefined) {
        continue;
      }
      const loggedUser = log.args[0];
      const sbtInfo = await sbtContract.getVerificationSBTInfo(loggedUser);

      // check if the SBT is still valid
      if (
        filterExpiration &&
        sbtInfo.expirationTime < BigNumber.from(lastBlockTime)
      ) {
        continue;
      }

      if (sbtListRes.has(sbtContractAddr)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        sbtListRes.get(sbtContractAddr)!.push(sbtInfo);
      } else {
        sbtListRes.set(sbtContractAddr, [sbtInfo]);
      }
    }
  }

  return sbtListRes;
}
