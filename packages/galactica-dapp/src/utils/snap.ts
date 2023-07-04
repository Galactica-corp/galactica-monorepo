import { RpcMethods } from '../../../snap/src/rpcEnums';
import { defaultSnapOrigin } from '../config';
import { GetSnapsResponse, Snap } from '../types';

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
 * generateProof prepares and executes the call to generate a ZKP in the Galactica snap.
 * You can use it to generate various kinds of proofs, depending on the input you pass.
 *
 * @param proverData - Prover data passed to the snap (including wasm and zkey).
 * @param proofInput - Input for the proof.
 * @returns Request result that should contain the ZKP.
 */
export const generateProof = async (
  proverData: any,
  proofInput: any,
) => {
  console.log('sending generateProof request to snap with publicInput:',
    JSON.stringify(proofInput, null, 2));

  const userAddress = window.ethereum.selectedAddress;
  if (userAddress === null) {
    throw new Error('Please connect a metamask account first.');
  }

  const res = await window.ethereum.request({
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
          userAddress,
          wasm: proverData.wasm,
          zkeyHeader: proverData.zkeyHeader,
          zkeySections: proverData.zkeySections,
        },
      },
    },
  });

  console.log('Received ZKP response', JSON.stringify(res, null, 2));

  if (res === undefined || res === null) {
    throw new Error('Proof generation failed: empty response');
  }

  return res;
};

export const isLocalSnap = (snapId: string) => snapId.startsWith('local:');
