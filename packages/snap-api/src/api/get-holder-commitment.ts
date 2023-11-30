import type { HolderCommitmentData } from '@galactica-net/galactica-types';

import { RpcMethods } from './rpcEnums';
import { sdkConfig } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * GetHolderCommitment queries the commitment identifying the holder from the snap.
 * The returned data is required by guardians to create ZK certificates.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns HolderCommitmentData or Error.
 * @throws RPCError on failure.
 */
export const getHolderCommitment = async (
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  const response: HolderCommitmentData = await invokeSnap(
    {
      method: RpcMethods.GetHolderCommitment,
    },
    snapOrigin,
  );

  return response;
};
