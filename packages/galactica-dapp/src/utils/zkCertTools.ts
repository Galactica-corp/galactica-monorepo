import { BigNumber, ethers } from 'ethers';

import GuardianRegistryABI from '../config/abi/GuardianRegistry.json';
import VerificationSbtABI from '../config/abi/IVerificationSBT.json';
import IVerificationSBTIssuer from '../config/abi/IVerificationSBTIssuer.json';
import KYCRecordRegistryABI from '../config/abi/KYCRecordRegistry.json';

/**
 * Data structure for a verification SBT.
 * Fields should match the VerificationSBTInfo struct in the smart contract.
 */
export class SBT {
  constructor(
    public sbtAddr: string,
    public verifierWrapper: string,
    public expirationTime: number,
    public verifierCodehash: string,
    public encryptedData: string[],
    public userPubKey: string[2],
    public humanID: string,
    public providerPubKey: string[2],
  ) { } // eslint-disable-line no-empty-function
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

/**
 * Finds verification SBT of a user.
 * @param sbtContractAddr - Address of the verification SBT contract holding the mapping of completed verifications.
 * @param provider - Provider to use to query logs.
 * @param userAddr - Address of the user to find verification SBTs for.
 * @param filterExpiration - Whether to filter out expired SBTs (default: false).
 * @returns Verification SBT or undefined if it does not exist.
 */
export async function queryVerificationSBT(
  sbtContractAddr: string,
  provider: ethers.providers.Web3Provider,
  userAddr: string,
  filterExpiration = false,
): Promise<SBT | undefined> {
  const sbtContract = new ethers.Contract(
    sbtContractAddr,
    VerificationSbtABI.abi,
    provider,
  );
  if (filterExpiration && sbtContract.isVerificationSBTValid(userAddr)) {
    return undefined;
  }

  const sbtInfo = await sbtContract.getVerificationSBTInfo(userAddr);

  if (BigNumber.from(sbtInfo.verifierWrapper).eq(0)) {
    // if there is no verifierWrapper set, no SBT has been issued
    return undefined;
  }

  return new SBT(
    sbtContractAddr,
    sbtInfo.verifierWrapper,
    BigNumber.from(sbtInfo.expirationTime).toNumber(),
    sbtInfo.verifierCodehash,
    sbtInfo.encryptedData,
    sbtInfo.userPubKey,
    sbtInfo.humanID,
    sbtInfo.providerPubKey,
  );
}

export async function showVerificationSBTs(
  sbtIssuingContracts: string[],
  zkKYCRegistryAddr: string,
): Promise<{ sbts: SBT[]; guardianNameMap: Map<string[2], string> }> {
  // @ts-expect-error https://github.com/metamask/providers/issues/200
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const sbts = [];
  for (const sbtContractAddr of sbtIssuingContracts) {
    try {
      const dAppContract = new ethers.Contract(sbtContractAddr, IVerificationSBTIssuer.abi, signer);
      const sbtContract = await dAppContract.sbt();
      const sbt = await queryVerificationSBT(
        await sbtContract,
        provider,
        await signer.getAddress(),
      );
      if (sbt) {
        sbts.push(sbt);
      }
    } catch (error) {
      console.log(`Could not query SBTs for an address ${sbtContractAddr}`, error);
    }
  }
  const guardianNameMap = await getGuardianNameMap(
    sbts,
    zkKYCRegistryAddr,
    provider,
  );
  console.log(
    `Verification SBTs:\n ${formatVerificationSBTs(sbts, guardianNameMap)} `,
  );
  return { sbts, guardianNameMap };
}

export function formatVerificationSBTs(
  sbts: SBT[],
  providerNameMap: Map<string[2], string>,
): string {
  let res = '';
  let count = 1;
  for (const sbt of sbts) {
    res += `SBT ${count}:\n`;
    res += `  addr ${sbt.sbtAddr}\n`;
    res += `  expiration ${new Date(
      sbt.expirationTime * 1000,
    ).toDateString()}\n`;
    /* eslint-disable @typescript-eslint/restrict-template-expressions */
    res += `  humanID ${sbt.humanID}\n`;
    res += `  provider ${JSON.stringify(
      providerNameMap.get(sbt.providerPubKey),
    )}\n`;
    /* eslint-enable @typescript-eslint/restrict-template-expressions */
    res += `\n`;

    count += 1;
  }
  return res;
}

/**
 * Query guardian name string from on-chain registry for being able to display a nice name.
 * @param pubKey - PubKey of the guardian pubKey in form [Ax, Ay].
 * @param registryAddr - Address of the registry contract where the zkCert is registered.
 * @param provider - Ethereum provider to use to query the registry.
 * @returns Guardian name.
 */
export async function getGuardianName(
  pubKey: string[2],
  registryAddr: string,
  provider: ethers.providers.Web3Provider,
): Promise<string> {
  const registryContract = new ethers.Contract(
    registryAddr,
    KYCRecordRegistryABI.abi,
    provider,
  );
  const guardianWhitelistContract = new ethers.Contract(
    await registryContract._GuardianRegistry(),
    GuardianRegistryABI.abi,
    provider,
  );
  const guardianAddr = await guardianWhitelistContract.pubKeyToAddress(
    pubKey[0],
    pubKey[1],
  );
  const guardianInfo = await guardianWhitelistContract.guardians(guardianAddr);

  return guardianInfo.name;
}

/**
 * Constructs a map of guardian pubKey->name for a list of SBTs.
 * @param sbts - List of SBTs to get the guardian name for.
 * @param registryAddr - Address of the registry contract where the zkCert is registered.
 * @param provider - Ethereum provider to use to query the registry.
 * @returns Map of guardian pubKey->name.
 */
export async function getGuardianNameMap(
  sbts: SBT[],
  registryAddr: string,
  provider: ethers.providers.Web3Provider,
): Promise<Map<string[2], string>> {
  const providerNameMap = new Map<string, string>();
  for (const sbt of sbts) {
    if (!providerNameMap.has(sbt.providerPubKey)) {
      const providerName = await getGuardianName(
        sbt.providerPubKey,
        registryAddr,
        provider,
      );
      providerNameMap.set(sbt.providerPubKey, providerName);
    }
  }
  return providerNameMap;
}
