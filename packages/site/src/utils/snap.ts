import { defaultSnapOrigin } from '../config';
import { GetSnapsResponse, Snap } from '../types';
import { ExportRequestParams, RpcMethods, ZkCertStandard } from './../../../snap/src/types';
import { ZkKYCContent } from '../../../snap/src/zkCertTypes';

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
  } catch (e) {
    console.log('Failed to obtain installed snap', e);
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
        method: RpcMethods.setupHoldingKey,
        params: {},
      },
    ],
  });
};

export const generateProof = async (proverData: any) => {
  // TODO: add type for proverData
  // TODO: move filling input inside snap

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const now = new Date();
  const publicInput = {
    currentTime: currentTimestamp,
    currentYear: now.getUTCFullYear().toString(),
    currentMonth: (now.getUTCMonth() + 1).toString(),
    currentDay: now.getUTCDate().toString(),
    ageThreshold: "18"
  };
  console.log("publicInput", publicInput);

  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: [
      defaultSnapOrigin,
      {
        method: RpcMethods.genZkKycProof,
        params: {
          input: publicInput,
          requirements: {
            zkCertStandard: ZkCertStandard.zkKYC,
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
        method: RpcMethods.clearStorage,
        params: {},
      },
    ],
  });
};

export const importZkCert = async (zkCertJson: any) => {
  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: [
      defaultSnapOrigin,
      {
        method: RpcMethods.importZkCert,
        params: {zkCert: zkCertJson},
      },
    ],
  });
};

export const importZkCert = async (zkCertJson: any) => {
  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: [
      defaultSnapOrigin,
      {
        method: RpcMethods.importZkCert,
        params: { zkCert: zkCertJson },
      },
    ],
  });
};

export const exportZkCert = async () => {
  const params: ExportRequestParams = {
    zkCertStandard: ZkCertStandard.zkKYC,
  };

  return await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: [
      defaultSnapOrigin,
      {
        method: RpcMethods.exportZkCert,
        params: params,
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
        method: RpcMethods.getHolderCommitment,
        params: {},
      },
    ],
  });
};

export const isLocalSnap = (snapId: string) => snapId.startsWith('local:');
