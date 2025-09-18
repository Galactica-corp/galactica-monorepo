import type { GenZkProofParams, ZkProof } from '@galactica-net/galactica-types';

import { sdkConfig } from '../config';
import { GalacticaErrorBase } from './error';
import { RpcMethods } from './rpcEnums';
import type { ZkCertInputType } from './zkpInputTypes';
import { invokeSnap } from '../utils/invoke-snap';

type GenZKPErrorName = 'MissingInputParams' | 'ProverFetchFailed';

export class GenZKPError extends GalacticaErrorBase<GenZKPErrorName> {}

/**
 * GenerateZKProof prepares and executes the call to generate a ZKP in the Galactica snap.
 * You can use it to generate various kinds of proofs, depending on the input you pass.
 *
 * @param params - The parameters required to generate a ZKP in the Snap.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns Request result with the ZK proof or error.
 * @throws RPCError on failure.
 */
export const generateZKProof = async (
  params: GenZkProofParams<ZkCertInputType>,
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  const response: ZkProof = await invokeSnap(
    {
      method: RpcMethods.GenZkCertProof,
      params,
    },
    snapOrigin,
  );

  return response;
};
