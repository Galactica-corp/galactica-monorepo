import { ethers, BigNumber, EventFilter } from 'ethers';

import VerificationSbtABI from '../config/abi/IVerificationSBT.json';
import { getLocalStorage, setLocalStorage } from './localStorage';

/**
 * Data structure for a verification SBT.
 * Fields should match the VerificationSBTInfo struct in the smart contract.
 */
export class SBT {
  constructor(
    public dApp: string,
    public verifierWrapper: string,
    public expirationTime: number,
    public verifierCodehash: string,
    public encryptedData: string[],
    public userPubKey: string[],
    public humanID: string,
    public providerPubKey: string,
  ) {}
}

/**
 * Data structure for cached data of a user's verification SBTs.
 * This speeds up finding verification SBTs for a user significantly on consecutive calls.
 */
export class SBTsPerAddress {
  // users verification SBTs, expired ones are filtered out
  public verificationSBTs: SBT[];

  // latest block that was checked for verification SBTs so that the next search can start from there
  public latestBlockChecked: number;

  // address of the user (multiple wallets might have been used on the same browser)
  public userAddress: string;

  constructor(userAddress: string) {
    this.latestBlockChecked = 0;
    this.verificationSBTs = [];
    this.userAddress = userAddress;
  }
}

const LOCAL_STORAGE_KEY_SBT = 'cachedVerificationSBTs';

/**
 * Finds verification SBTs for a user. Searches through logs of created verificationSBTs
 * and filters according to the userAddr (and optionally dAppAddr and humanID) provided.
 * Modifies the local storage to speedup future calls by caching results.
 *
 * @param sbtContractAddr - Address of the verification SBT contract holding the mapping of completed verifications.
 * @param provider - Provider to use to query logs.
 * @param userAddr - Address of the user to find verification SBTs for.
 * @param dAppAddr - Address of the dApp the SBT was created for (default: undefined).
 * @param humanID - HumanID of the user the SBT was created for (default: undefined).
 * @param filterExpiration - Whether to filter out expired SBTs (default: false).
 * @returns List of verification SBTs.
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

  const localStorage = getLocalStorage(LOCAL_STORAGE_KEY_SBT);
  let cachedSBTsPerAddr: SBTsPerAddress[];
  if (localStorage === null) {
    cachedSBTsPerAddr = [];
  } else {
    cachedSBTsPerAddr = JSON.parse(localStorage);
  }

  // find user's cached SBTs
  let userIndex = -1;
  for (let i = 0; i < cachedSBTsPerAddr.length; i++) {
    if (cachedSBTsPerAddr[i].userAddress === userAddr) {
      userIndex = i;
      break;
    }
  }

  let userSBTs: SBTsPerAddress;
  if (userIndex === -1) {
    userSBTs = new SBTsPerAddress(userAddr);
    cachedSBTsPerAddr.push(userSBTs);
    userIndex = cachedSBTsPerAddr.length - 1;
  } else {
    userSBTs = cachedSBTsPerAddr[userIndex];
    // filter out SBTs that expired since the last time they were checked
    userSBTs.verificationSBTs = userSBTs.verificationSBTs.filter(
      (sbt) => sbt.expirationTime > lastBlockTime,
    );
    // It might happen that the browser cache contains SBTs that are not in the blockchain anymore because of a fork.
    // We ignore this because it is unlikeluy and it is not relevant for security because it only impacts the user's browser.
  }

  // filter through all logs adding a verification SBT for the user
  const filter = {
    address: sbtContractAddr,
    topics: [
      ethers.utils.id('VerificationSBTMinted(address,address,bytes32)'),
      dAppAddr ? ethers.utils.hexZeroPad(dAppAddr, 32) : null,
      userAddr ? ethers.utils.hexZeroPad(userAddr, 32) : null,
      humanID ? ethers.utils.hexZeroPad(humanID, 32) : null,
    ],
  };

  // query block of verification SBT contract deployment so that new users do not have to search from genesis
  const earliestBlock = await sbtContract.deploymentBlock();
  const firstBlock = Math.max(userSBTs.latestBlockChecked, earliestBlock);
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
      console.log(`found sbtInfo: ${JSON.stringify(log, null, 2)}}`);
      if (log.topics === undefined) {
        continue;
      }
      const loggedDApp = ethers.utils.hexDataSlice(log.topics[1], 12);
      const sbtInfo = await sbtContract.getVerificationSBTInfo(
        userAddr,
        loggedDApp,
      );

      if (
        filterExpiration &&
        sbtInfo.expirationTime < BigNumber.from(lastBlockTime)
      ) {
        continue; // skip expired SBT
      }

      userSBTs.verificationSBTs.push(
        new SBT(
          sbtInfo.dApp,
          sbtInfo.verifierWrapper,
          BigNumber.from(sbtInfo.expirationTime).toNumber(),
          sbtInfo.verifierCodehash,
          sbtInfo.encryptedData,
          sbtInfo.userPubKey,
          sbtInfo.humanID,
          sbtInfo.providerPubKey,
        ),
      );
    }
  }

  // update cached SBTs
  userSBTs.latestBlockChecked = currentBlock;
  cachedSBTsPerAddr[userIndex] = userSBTs;
  setLocalStorage(LOCAL_STORAGE_KEY_SBT, JSON.stringify(cachedSBTsPerAddr));

  return userSBTs.verificationSBTs;
}

export function formatVerificationSBTs(sbts: SBT[]): string {
  let res = '';
  let count = 1;
  for (const sbt of sbts) {
    res += `SBT ${count}:\n`;
    res += `  proven to DApp ${sbt.dApp}\n`;
    res += `  expiration ${new Date(
      sbt.expirationTime * 1000,
    ).toDateString()}\n`;
    /* eslint-disable @typescript-eslint/restrict-template-expressions */
    res += `  humanID ${sbt.humanID}\n`;
    res += `  provider ${JSON.stringify(sbt.providerPubKey)}\n`;
    /* eslint-enable @typescript-eslint/restrict-template-expressions */
    res += `\n`;

    count += 1;
  }
  return res;
}
