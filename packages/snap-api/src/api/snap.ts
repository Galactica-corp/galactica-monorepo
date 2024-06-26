import { sdkConfig } from '../config';

export type GetSnapsResponse = Record<string, Snap>;

export type Snap = {
  permissionName: string;
  id: string;
  version: string;
  initialPermissions: Record<string, unknown>;
};

/**
 * Get the installed snaps in MetaMask.
 * @returns The snaps installed in MetaMask.
 */
export const getSnaps = async (): Promise<GetSnapsResponse> => {
  return (await window.ethereum.request({
    method: 'wallet_getSnaps',
  })) as unknown as GetSnapsResponse;
};

/**
 * Connect a snap to MetaMask.
 * @param snapId - The ID of the snap.
 * @param params - The params to pass with the snap to connect.
 */
export const connectSnap = async (
  snapId: string = sdkConfig.defaultSnapOrigin,
  params: Record<'version', unknown> = { version: undefined },
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
 * @param snapId - The ID of the snap.
 * @param version - The version of the snap to install (optional).
 * @returns The snap object returned by the extension.
 */
export const getSnap = async (
  snapId: string = sdkConfig.defaultSnapOrigin,
  version?: string,
): Promise<Snap | undefined> => {
  try {
    const snaps = await getSnaps();

    return Object.values(snaps).find(
      (snap) => snap.id === snapId && (!version || snap.version === version),
    );
  } catch (error) {
    console.log('Failed to obtain installed snap', error);
    return undefined;
  }
};

export const isLocalSnap = (snapId: string) => snapId.startsWith('local:');
