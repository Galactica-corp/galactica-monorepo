import { ethers, BigNumber, EventFilter } from 'ethers';

import VerificationSbtABI from '../config/abi/IVerificationSBT.json';

/**
 * Finds verification SBTs for a user. Searches through logs of created verificationSBTs
 * and filters according to the userAddr, dAppAddr, and humanID provided.
 *
 * @param sbtContractAddr - Address of the verification SBT contract holding the mapping of completed verifications.
 * @param provider - Provider to use to query logs.
 * @param userAddr - Address of the user to find verification SBTs for (default: undefined).
 * @param dAppAddr - Address of the dApp the SBT was created for (default: undefined).
 * @param humanID - HumanID of the user the SBT was created for (default: undefined).
 * @param filterExpiration - Whether to filter out expired SBTs (default: false).
 * @returns Map of verification SBTs (address of contract it was proven to => verification SBT data).
 */
export async function queryVerificationSBTs(
  sbtContractAddr: string,
  provider: ethers.providers.Web3Provider,
  userAddr: string | undefined = undefined,
  dAppAddr: string | undefined = undefined,
  humanID: string | undefined = undefined,
  filterExpiration = false,
): Promise<Map<string, any>> {
  const sbtContract = new ethers.Contract(
    sbtContractAddr,
    VerificationSbtABI.abi,
    provider,
  );

  const currentBlock = await provider.getBlockNumber();
  const lastBlockTime = (await provider.getBlock(currentBlock)).timestamp;
  const sbtListRes = new Map<string, any>();

  // go through all logs adding a verification SBT for the user
  const filter = {
    address: sbtContractAddr,
    topics: [
      ethers.utils.id('VerificationSBTMinted(address,address,bytes32)'),
      dAppAddr ? ethers.utils.hexZeroPad(dAppAddr, 32) : null,
      userAddr ? ethers.utils.hexZeroPad(userAddr, 32) : null,
      humanID ? ethers.utils.hexZeroPad(humanID, 32) : null,
    ],
  };
  console.log(JSON.stringify(filter, null, 2));

  // TODO: add dynamic way to find first block
  const firstBlock = 600000;
  const maxBlockInterval = 10000;

  // get logs in batches of 10000 blocks
  for (let i = firstBlock; i < currentBlock; i += maxBlockInterval) {
    console.log(`Querying logs from block ${i} to ${i + maxBlockInterval}...`);
    const createStakeLogs = await sbtContract.queryFilter(
      filter as EventFilter,
      i,
      i + maxBlockInterval,
    );

    for (const log of createStakeLogs) {
      if (log.topics === undefined) {
        continue;
      }
      const loggedDApp = ethers.utils.hexDataSlice(log.topics[1], 12);
      const loggedUser = ethers.utils.hexDataSlice(log.topics[2], 12);

      const sbtInfo = await sbtContract.getVerificationSBTInfo(
        loggedUser,
        loggedDApp,
      );

      // check if the SBT is still valid
      if (
        filterExpiration &&
        sbtInfo.expirationTime < BigNumber.from(lastBlockTime)
      ) {
        continue;
      }

      const previousEntries = sbtListRes.get(loggedDApp);
      if (previousEntries === undefined) {
        sbtListRes.set(loggedDApp, [sbtInfo]);
      } else {
        previousEntries.push(sbtInfo);
      }
    }
  }
  return sbtListRes;
}

export function formatVerificationSBTs(sbtMap: Map<string, any[]>): string {
  let res = '';
  let count = 1;
  sbtMap.forEach((sbtList, dAppAddr) => {
    for (const sbt of sbtList) {
      console.log(`sbt ${count}: ${JSON.stringify(sbt, null, 2)}}`);
      res += `SBT ${count}:\n`;
      res += `  proven to DApp ${dAppAddr}\n`;
      res += `  expiration ${new Date(sbt.expirationTime * 1000).toDateString()}\n`;
      res += `  humanID ${sbt.humanID}\n`;
    }
  });
  return res;
}
