import {
  ExportRequestParams,
  RpcMethods,
  ZkCertStandard,
} from '../../../snap/src/types';
import { defaultSnapOrigin } from '../config';
import { GetSnapsResponse, Snap } from '../types';
import { getCurrentBlockTime } from './metamask';
import { bytesToString } from '@metamask/utils';

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
  await window.ethereum.request({
    method: 'wallet_enable',
    params: [
      {
        wallet_snap: {
          [snapId]: {
            ...params,
          },
        },
      },
    ],
  });
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
 * Invoke the methods from the example snap.
 */

export const setupHoldingKey = async () => {
  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: [
      defaultSnapOrigin,
      {
        method: RpcMethods.SetupHoldingKey,
        params: {},
      },
    ],
  });
};

export const generateProof = async (proverData: any) => {
  // TODO: add type for proverData

  // expected time for between pressing the generation button and the verification happening on-chain
  const estimatedProofCreationDuration = 20;

  const currentTimestamp =
    (await getCurrentBlockTime()) + estimatedProofCreationDuration;
  const dateNow = new Date(currentTimestamp * 1000);

  const publicInput = {
    currentTime: currentTimestamp,
    currentYear: dateNow.getUTCFullYear().toString(),
    currentMonth: (dateNow.getUTCMonth() + 1).toString(),
    currentDay: dateNow.getUTCDate().toString(),
    ageThreshold: '18',
  };
  console.log('publicInput', publicInput);

  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: [
      defaultSnapOrigin,
      {
        method: RpcMethods.GenZkKycProof,
        params: {
          input: publicInput,
          requirements: {
            zkCertStandard: ZkCertStandard.ZkKYC,
          },
          wasm: proverData.wasm,
          zkeyHeader: proverData.zkeyHeader,
          zkeySections: proverData.zkeySections,
        },
      },
    ],
  });
};

export const clearStorage = async () => {
  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: [
      defaultSnapOrigin,
      {
        method: RpcMethods.ClearStorage,
        params: {},
      },
    ],
  });
};

export const importZkCert = async (zkCertJson: any) => {
  console.log({ zkCert: zkCertJson });
  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: [
      defaultSnapOrigin,
      {
        method: RpcMethods.ImportZkCert,
        params: { zkCert: zkCertJson },
      },
    ],
  });
};

export const exportZkCert = async () => {
  const params: ExportRequestParams = {
    zkCertStandard: ZkCertStandard.ZkKYC,
  };

  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: [
      defaultSnapOrigin,
      {
        method: RpcMethods.ExportZkCert,
        params,
      },
    ],
  });
};

export const getHolderCommitment = async () => {
  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: [
      defaultSnapOrigin,
      {
        method: RpcMethods.GetHolderCommitment,
        params: {},
      },
    ],
  });
};

export const isLocalSnap = (snapId: string) => snapId.startsWith('local:');
