/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import type { FieldElement } from './fieldElement';
import type { OwnershipProofInput } from './zkCert';
import type { ZkCertStandard } from './zkCertStandard';

// Type definitions to avoid circular dependency with snap-api
export type ProverData = {
  wasm: any;
  zkeyHeader: any;
  zkeySections: any[];
};

export type ProverLink = {
  url: string;
  hash: string;
};

export type ZkProof = {
  proof: {
    /* eslint-disable @typescript-eslint/naming-convention */
    pi_a: [string, string];
    pi_b: [[string, string], [string, string]];
    pi_c: [string, string];
    /* eslint-enable @typescript-eslint/naming-convention */
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
};

export type GenZkProofParams<ProofInputType> = {
  input: ProofInputType;
  requirements: {
    zkCertStandard: ZkCertStandard;
    registryAddress: string;
  };
  prover: ProverData | ProverLink;
  userAddress: string;
  description: string;
  publicInputDescriptions: string[];
  zkInputRequiresPrivKey: boolean;
};

export type PreparedZkCertProofInputs<
  Params extends Record<string, FieldElement | FieldElement[]>,
  Content extends Record<string, unknown>,
> = Params &
  Record<keyof Content, FieldElement> &
  OwnershipProofInput & {
    expirationDate: number;
    leafIndex: number;
    pathElements: string[];
    providerAx: string;
    providerAy: string;
    providerR8x: string;
    providerR8y: string;
    providerS: string;
    r8x2: string;
    r8y2: string;
    randomSalt: string;
    root: string;
    s2: string;
    userAddress: string;
    userPrivKey?: string;
  };
