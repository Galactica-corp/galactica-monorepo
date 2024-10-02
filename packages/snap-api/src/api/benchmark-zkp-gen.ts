import { RpcMethods } from './rpcEnums';
import type { ProverData, ProverLink, ZkCertProof } from './types';
import { sdkConfig } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Parameter for requests to benchmark the ZK proof generation within the Galactica Snap.
 */
export type BenchmarkZKPGenParams = {
  // Input for the ZKP generation.
  input: Record<string, any>;

  // Prover to generate the ZKP.
  prover: ProverData | ProverLink;
};

/**
 * BenchmarkZKPGen runs and measures the ZK proof generation in the Snap.
 * @param params - The parameters required to generate a ZKP in the Snap.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns Request result with the ZK proof or error.
 * @throws RPCError on failure.
 */
export const benchmarkZKPGen = async (
  params: BenchmarkZKPGenParams,
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  const response: ZkCertProof = await invokeSnap(
    {
      method: RpcMethods.BenchmarkZKPGen,
      params,
    },
    snapOrigin,
  );

  return response;
};
