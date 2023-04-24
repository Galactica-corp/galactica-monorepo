import { RpcMethods } from '../../../snap/src/rpcEnums';
import { ZkKYCAgeProofInput } from '../../../snap/src/types';
import { defaultSnapOrigin } from '../config';
import { GetSnapsResponse, Snap } from '../types';
import { getCurrentBlockTime } from './metamask';

/**
 * Get the installed snaps in MetaMask.
 *
 * @returns The snaps installed in MetaMask.
 */
export const getSnaps = async (): Promise<GetSnapsResponse> => {
  return (await window.ethereum.request({
    method: 'wallet_getSnaps',
  })) as unknown as GetSnapsResponse;
};

/**
 * Connect a snap to MetaMask.
 *
 * @param snapId - The ID of the snap.
 * @param params - The params to pass with the snap to connect.
 */
export const connectSnap = async (
  snapId: string = defaultSnapOrigin,
  params: Record<'version' | string, unknown> = {},
) => {
  console.log('Connecting to snap', snapId, params);
  const res = await window.ethereum.request({
    method: 'wallet_requestSnaps',
    params: {
      [snapId]: {
        ...params,
      },
    },
  });
  console.log(JSON.stringify(res, null, 2));
};

/**
 * Get the snap from MetaMask.
 *
 * @param version - The version of the snap to install (optional).
 * @returns The snap object returned by the extension.
 */
export const getSnap = async (version?: string): Promise<Snap | undefined> => {
  try {
    const snaps = await getSnaps();

    return Object.values(snaps).find(
      (snap) =>
        snap.id === defaultSnapOrigin && (!version || snap.version === version),
    );
  } catch (error) {
    console.log('Failed to obtain installed snap', error);
    return undefined;
  }
};

/**
 * GenerateProof prepares and executes the call to generate a ZKP in the Galactica snap.
 *
 * @param proverData - Prover data passed to the snap (including wasm and zkey).
 * @param dAppAddress - Contract address to send the ZKP to.
 * @param investigationInstitutionPubKey - Public key of the institution that can investigate the ZKP.
 * @returns Request result that should contain the ZKP.
 */
export const generateProof = async (
  proverData: any,
  dAppAddress: string,
  investigationInstitutionPubKey: [string, string],
) => {
  // TODO: add type for proverData

  // expected time for between pressing the generation button and the verification happening on-chain
  const estimatedProofCreationDuration = 20;

  const currentTimestamp =
    (await getCurrentBlockTime()) + estimatedProofCreationDuration;
  const dateNow = new Date(currentTimestamp * 1000);

  const proofInput: ZkKYCAgeProofInput = {
    // general zkKYC inputs
    currentTime: currentTimestamp,
    dAppAddress,
    investigationInstitutionPubKey,
    // the zkKYC itself is not needed here. It is filled by the snap for user privacy.

    // age proof specific inputs
    currentYear: dateNow.getUTCFullYear().toString(),
    currentMonth: (dateNow.getUTCMonth() + 1).toString(),
    currentDay: dateNow.getUTCDate().toString(),
    ageThreshold: '18',
  };
  console.log('publicInput', proofInput);

  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: RpcMethods.GenZkKycProof,
        params: {
          input: proofInput,
          requirements: {
            zkCertStandard: 'gip69',
          },
          wasm: proverData.wasm,
          zkeyHeader: proverData.zkeyHeader,
          zkeySections: proverData.zkeySections,
        },
      },
    },
  });
};

export const isLocalSnap = (snapId: string) => snapId.startsWith('local:');
