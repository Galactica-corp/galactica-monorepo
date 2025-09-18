/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// SPDX-License-Identifier: BUSL-1.1
import type {
  GenZkProofParams,
  ProverData,
  ProverLink,
  ZkCertInputType,
  ZkProof,
} from '@galactica-net/snap-api';
import { GenZKPError } from '@galactica-net/snap-api';
import { divider, heading, text } from '@metamask/snaps-ui';

import type { PanelContent } from './types';
import { stripURLProtocol } from './utils';

/**
 * Generate proof confirmation prompt for the user.
 *
 * @param params - Parameters defining the proof to be generated.
 * @param proof - Proof to be confirmed.
 * @param origin - Origin of the request.
 * @returns PanelContent for the proof confirmation prompt.
 */
export function createProofConfirmationPrompt(
  params: GenZkProofParams<any>,
  proof: ZkProof,
  origin: string,
): PanelContent {
  const proofConfirmDialog = [
    heading('Disclosing zkCertificate Proof'),
    text(
      `With this action you will create a ${params.requirements.zkCertStandard.toUpperCase()} proof for ${stripURLProtocol(
        origin,
      )}.
       This action tests whether your personal data fulfills the requirements of the proof.`,
    ),
    divider(),
  ];

  // Description of disclosures made by the proof have to be provided by the front-end because the snap can not analyze what the prover will do.
  if (params.description) {
    proofConfirmDialog.push(
      text(
        `Description of the proof (provided by ${stripURLProtocol(origin)}):`,
      ),
      text(params.description),
    );
  } else {
    throw new Error('Description of ZKP is missing');
  }

  // Generalize disclosure of inputs to any kind of inputs
  proofConfirmDialog.push(
    divider(),
    text(`The following proof parameters will be publicly visible:`),
  );

  if (params.publicInputDescriptions.length !== proof.publicSignals.length) {
    throw new Error(
      `Number of public input descriptions (${params.publicInputDescriptions.length}) does not match number of public inputs (${proof.publicSignals.length})`,
    );
  }
  proof.publicSignals.forEach((signal: any, index: number) => {
    proofConfirmDialog.push(
      text(
        `${params.publicInputDescriptions[index]}: ${JSON.stringify(signal)}`,
      ),
    );
  });
  return proofConfirmDialog;
}

/**
 * Check validity of the ZKP generation request.
 *
 * @param params - Parameters defining the proof to be generated.
 * @throws an error if the request is invalid.
 */
export function checkZkCertProofRequest(
  params: GenZkProofParams<ZkCertInputType>,
) {
  if (params.userAddress === undefined) {
    throw new GenZKPError({
      name: 'MissingInputParams',
      message: `userAddress missing in request parameters.`,
    });
  }
  if (params.requirements.zkCertStandard === undefined) {
    throw new GenZKPError({
      name: 'MissingInputParams',
      message: `ZkCert standard missing in request parameters.`,
    });
  }
  if (params.requirements.registryAddress === undefined) {
    throw new GenZKPError({
      name: 'MissingInputParams',
      message: `Registry address missing in request parameters.`,
    });
  }
  if (
    params.prover === undefined ||
    ((params.prover as ProverData).wasm === undefined &&
      (params.prover as ProverLink).url === undefined)
  ) {
    throw new GenZKPError({
      name: 'MissingInputParams',
      message: `Missing prover data.`,
    });
  }
  if (params.zkInputRequiresPrivKey === undefined) {
    throw new GenZKPError({
      name: 'MissingInputParams',
      message: `Missing field 'zkInputRequiresPrivKey' in GenZkProofParams.`,
    });
  }
}
