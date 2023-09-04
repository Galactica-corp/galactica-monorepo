/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { VerificationSBT } from '../typechain-types/contracts/VerificationSBT';
import { IVerificationSBT } from '../typechain-types/contracts/interfaces/IVerificationSBT';


/**
 * @description Finds verification SBTs for a user. Searches through logs of created verificationSBTs 
 *   and filters according to the userAddr, dAppAddr, and humanID provided.
 * 
 * @param sbtContractAddr Address of the verification SBT contract holding the mapping of completed verifications
 * @param userAddr Address of the user to find verification SBTs for (default: undefined)
 * @param dAppAddr Address of the dApp the SBT was created for (default: undefined)
 * @param humanID HumanID of the user the SBT was created for (default: undefined)
 * @param filterExpiration Whether to filter out expired SBTs (default: false)
 * @returns Map of verification SBTs (address of contract it was proven to => verification SBT data)
 */
export async function queryVerificationSBTs(
  sbtContractAddr: string,
  userAddr: string | undefined = undefined,
  dAppAddr: string | undefined = undefined,
  humanID: string | undefined = undefined,
  filterExpiration: boolean = false
)
  : Promise<Map<string, IVerificationSBT.VerificationSBTInfoStruct[]>> {
  const factory = await ethers.getContractFactory("VerificationSBT");
  const sbtContract = factory.attach(sbtContractAddr) as VerificationSBT;

  const currentBlock = await ethers.provider.getBlockNumber();
  const lastBlockTime = (await ethers.provider.getBlock(currentBlock)).timestamp;
  let sbtListRes = new Map<string, IVerificationSBT.VerificationSBTInfoStruct[]>();

  // go through all logs adding a verification SBT for the user
  const createStakeLogs = await sbtContract.queryFilter(sbtContract.filters.VerificationSBTMinted(dAppAddr, userAddr, humanID));

  for (let log of createStakeLogs) {
    const loggedDApp = log.args[0];
    const loggedUser = log.args[1];
    const sbtInfo = await sbtContract.getVerificationSBTInfo(loggedUser, loggedDApp);

    // check if the SBT is still valid
    if (filterExpiration && sbtInfo.expirationTime < BigNumber.from(lastBlockTime)) {
      continue;
    }

    if (sbtListRes.has(loggedDApp)) {
      sbtListRes.get(loggedDApp)!.push(sbtInfo);
    }
    else {
      sbtListRes.set(loggedDApp, [sbtInfo]);
    }
  }

  return sbtListRes;
}
