/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import type { FieldElement } from '@galactica-net/galactica-types';

import { RpcMethods } from './rpcEnums';
import type { ProverData, ProverLink, ZkProof } from './types';
import { sdkConfig } from '../config';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Parameter for requests to benchmark the ZK proof generation within the Galactica Snap.
 */
export type BenchmarkZKPGenParams = {
  // Input for the ZKP generation.
  input: Record<string, FieldElement | FieldElement[]>;

  // Prover to generate the ZKP.
  prover: ProverData | ProverLink;
};

/**
 * BenchmarkZKPGen runs and measures the ZK proof generation in the Snap.
 *
 * @param params - The parameters required to generate a ZKP in the Snap.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns Request result with the ZK proof or error.
 * @throws RPCError on failure.
 */
export const benchmarkZKPGen = async (
  params: BenchmarkZKPGenParams,
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  const response: ZkProof = await invokeSnap(
    {
      method: RpcMethods.BenchmarkZKPGen,
      params,
    },
    snapOrigin,
  );

  return response;
};
