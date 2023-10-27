import { BigNumber, ethers } from 'ethers';

import { getCurrentBlockTime } from './metamask';
import galacticaInstitutionABI from '../config/abi/IGalacticaInstitution.json';

/**
 * Prepares the proof input for the ZKP.
 *
 * @param dAppAddress - The address of the dApp the ZKP is for.
 * @param institutionAddresses - Addresses of involved institutions (if any) to get the pub key from.
 * @param additionalProofInput - Additional proof inputs that are not part of the core zkKYC.
 * @returns The ZKP requirements that will be part of the ZKP input.
 */
export async function prepareProofInput(
  dAppAddress: string,
  institutionAddresses: string[],
  additionalProofInput: any,
) {
  // expected time for between pressing the generation button and the verification happening on-chain
  const estimatedProofCreationDuration = 20;

  const expectedValidationTimestamp =
    (await getCurrentBlockTime()) + estimatedProofCreationDuration;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore https://github.com/metamask/providers/issues/200
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  // fetch institution pubkey from chain because it is needed as proof input
  const institutionPubKeys: [string, string][] = [];
  for (const addr of institutionAddresses) {
    const institutionContract = new ethers.Contract(
      addr,
      galacticaInstitutionABI.abi,
      signer,
    );
    institutionPubKeys.push([
      BigNumber.from(await institutionContract.institutionPubKey(0)).toString(),
      BigNumber.from(await institutionContract.institutionPubKey(1)).toString(),
    ]);
  }

  const proofInput: any = {
    // general zkKYC inputs
    currentTime: expectedValidationTimestamp,
    dAppAddress,
    investigationInstitutionPubKey: institutionPubKeys,
    // the zkKYC itself is not needed here. It is filled by the snap for user privacy.
  };
  if (additionalProofInput) {
    Object.assign(proofInput, additionalProofInput);
  }
  return proofInput;
}

/**
 * Get prover data (separately loaded because the large json should not slow down initial site loading).
 *
 * @param path - Path to the prover data json file (relative to the public folder).
 * @returns JSON object with the prover data.
 */
export async function getProver(path: string) {
  const proverText = await fetch(path);
  const parsedFile = JSON.parse(await proverText.text());
  return parsedFile;
}
