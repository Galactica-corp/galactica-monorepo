import { ethers, BigNumber, EventFilter } from 'ethers';

import VerificationSbtABI from '../config/abi/IVerificationSBT.json';
import { getLocalStorage } from './localStorage';



export class SBT {
  constructor(
    public dApp: string,
    public verifierWrapper: string,
    public expirationTime: number,
    public verifierCodehash: string,
    public encryptedData: string[],
    public userPubKey: string[],
    public humanID: string,
    public providerPubKey: string) {
  }
}

export class SBTsPerAddress {
  // mapping user addresses to SBTs
  public verificationSBTs: SBT[];
  public latestBlockChecked: number;
  public userAddress: string;

  constructor(userAddress: string) {
    this.latestBlockChecked = 0;
    this.verificationSBTs = [];
    this.userAddress = userAddress;
  }
}

/**
 * Finds verification SBTs for a user. Searches through logs of created verificationSBTs
 * and filters according to the userAddr, dAppAddr, and humanID provided.
 *
 * @param sbtContractAddr - Address of the verification SBT contract holding the mapping of completed verifications.
 * @param provider - Provider to use to query logs.
 * @param userAddr - Address of the user to find verification SBTs for.
 * @param dAppAddr - Address of the dApp the SBT was created for (default: undefined).
 * @param humanID - HumanID of the user the SBT was created for (default: undefined).
 * @param filterExpiration - Whether to filter out expired SBTs (default: false).
 * @returns Map of verification SBTs (address of contract it was proven to => verification SBT data).
 */
export async function queryVerificationSBTs(
  sbtContractAddr: string,
  provider: ethers.providers.Web3Provider,
  userAddr: string,
  dAppAddr: string | undefined = undefined,
  humanID: string | undefined = undefined,
  filterExpiration = false,
): Promise<SBT[]> {
  const sbtContract = new ethers.Contract(
    sbtContractAddr,
    VerificationSbtABI.abi,
    provider,
  );

  const currentBlock = await provider.getBlockNumber();
  const lastBlockTime = (await provider.getBlock(currentBlock)).timestamp;

  let cachedSBTString = getLocalStorage('cachedVerificationSBTs');
  let cachedSBTs: SBTsPerAddress[];

  if (cachedSBTString === null) {
    cachedSBTs = [];
  }
  else {
    cachedSBTs = JSON.parse(cachedSBTString);
  }

  // find users cached SBTs
  let userSBTs: SBTsPerAddress = new SBTsPerAddress(userAddr);
  for (let i of cachedSBTs) {
    if (i.userAddress === userAddr) {
      userSBTs = i;
      // filter out expired SBTs
      userSBTs.verificationSBTs = userSBTs.verificationSBTs.filter((sbt) => {
        return sbt.expirationTime > BigInt(lastBlockTime);
      });
    }
    // it might happen that the browser cache contains SBTs that are not in the current blockchain fork
    // we ignore this because this function is not relevant for security
  }

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
  console.log(`filter: ${JSON.stringify(filter, null, 2)}}`);

  // TODO: add dynamic way to find first block
  const firstBlock = userSBTs.latestBlockChecked;
  const maxBlockInterval = 10000;

  // get logs in batches of 10000 blocks because of rpc call size limit
  for (let i = firstBlock; i < currentBlock; i += maxBlockInterval) {
    const maxBlock = Math.min(i + maxBlockInterval, currentBlock);
    console.log(`Querying logs from block ${i} to ${maxBlock}...`);
    const createStakeLogs = await sbtContract.queryFilter(
      filter as EventFilter,
      i,
      maxBlock,
    );

    for (const log of createStakeLogs) {
      console.log(`sbtInfo: ${JSON.stringify(log, null, 2)}}`);
      if (log.topics === undefined) {
        continue;
      }
      const loggedDApp = ethers.utils.hexDataSlice(log.topics[1], 12);

      const sbtInfo = await sbtContract.getVerificationSBTInfo(
        userAddr,
        loggedDApp,
      );

      // check if the SBT is still valid
      if (
        filterExpiration &&
        sbtInfo.expirationTime < BigNumber.from(lastBlockTime)
      ) {
        continue;
      }

      userSBTs.verificationSBTs.push(
        new SBT(
          sbtInfo.dApp,
          sbtInfo.verifierWrapper,
          sbtInfo.expirationTime,
          sbtInfo.verifierCodehash,
          sbtInfo.encryptedData,
          sbtInfo.userPubKey,
          sbtInfo.humanID,
          sbtInfo.providerPubKey,
      ));
    }
  }

  userSBTs.latestBlockChecked = currentBlock;

  return userSBTs.verificationSBTs;
}

export function formatVerificationSBTs(sbtMap: Map<string, any[]>): string {
  let res = '';
  let count = 1;
  sbtMap.forEach((sbtList, dAppAddr) => {
    for (const sbt of sbtList) {
      res += `SBT ${count}:\n`;
      res += `  proven to DApp ${dAppAddr}\n`;
      res += `  expiration ${new Date(
        sbt.expirationTime * 1000,
      ).toDateString()}\n`;
      /* eslint-disable @typescript-eslint/restrict-template-expressions */
      res += `  humanID ${sbt.humanID}\n`;
      res += `  provider ${sbt.providerPubKey}\n`;
      /* eslint-enable @typescript-eslint/restrict-template-expressions */

      count += 1;
    }
  });
  return res;
}
