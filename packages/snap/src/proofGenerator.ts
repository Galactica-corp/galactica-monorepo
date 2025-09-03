/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// SPDX-License-Identifier: BUSL-1.1
import type { MerkleProof } from '@galactica-net/galactica-types';
import type {
  GenZkProofParams,
  ProverData,
  ProverLink,
  ZkCertInputType,
  ZkCertProof,
} from '@galactica-net/snap-api';
import { GenZKPError } from '@galactica-net/snap-api';
import type { ZkCertificate } from '@galactica-net/zk-certificates';
import {
  prepareZkCertProofInputs,
  subPathWasm,
  subPathZkeyHeader,
  subPathZkeySections,
} from '@galactica-net/zk-certificates';
import { divider, heading, text } from '@metamask/snaps-ui';
import { Buffer } from 'buffer';
import { buildBls12381, buildBn128 } from 'ffjavascript';
import { MD5 } from 'object-hash';
import { groth16 } from 'snarkjs';

import type { HolderData, PanelContent } from './types';
import { stripURLProtocol } from './utils';

/**
 * Generates a zero-knowledge proof using the provided inputs and prover information.
 * This is a local implementation using the SES-compatible snarkjs version.
 *
 * @param inputs - The input data required for generating the proof.
 * @param proverOrLink - The prover data or a link to fetch the prover data.
 * @returns A promise that resolves to the generated proof and public signals.
 */
export async function generateProof(
  inputs: Record<string, unknown>,
  proverOrLink: ProverData | ProverLink,
): Promise<ZkCertProof> {
  let prover: ProverData;
  if ('wasm' in proverOrLink) {
    prover = proverOrLink;
  } else {
    if (!('url' in proverOrLink)) {
      throw new Error('ProverLink does not contain a URL.');
    }
    prover = await fetchProverData(proverOrLink);
  }

  const processedProver = await preprocessProver(prover);

  const { proof, publicSignals } = await groth16.fullProveMemory(
    inputs,
    processedProver.wasm,
    processedProver.zkeyHeader,
    processedProver.zkeySections,
  );
  return { proof, publicSignals };
}

/**
 * Transforms and preprocesses the provided ProverData object.
 *
 * @param prover - The prover data to preprocess
 * @returns A new ProverData object with processed values
 */
async function preprocessProver(prover: ProverData): Promise<ProverData> {
  // Create a new object to avoid mutating the input
  const processedProver: ProverData = {
    wasm: Uint8Array.from(Buffer.from(prover.wasm, 'base64')),
    zkeyHeader: {
      ...prover.zkeyHeader,
      q: BigInt(prover.zkeyHeader.q),
      r: BigInt(prover.zkeyHeader.r),
      vk_alpha_1: Uint8Array.from(
        Buffer.from(prover.zkeyHeader.vk_alpha_1, 'base64'),
      ),
      vk_beta_1: Uint8Array.from(
        Buffer.from(prover.zkeyHeader.vk_beta_1, 'base64'),
      ),
      vk_beta_2: Uint8Array.from(
        Buffer.from(prover.zkeyHeader.vk_beta_2, 'base64'),
      ),
      vk_gamma_2: Uint8Array.from(
        Buffer.from(prover.zkeyHeader.vk_gamma_2, 'base64'),
      ),
      vk_delta_1: Uint8Array.from(
        Buffer.from(prover.zkeyHeader.vk_delta_1, 'base64'),
      ),
      vk_delta_2: Uint8Array.from(
        Buffer.from(prover.zkeyHeader.vk_delta_2, 'base64'),
      ),
      curve: await getCurveForSnarkJS(prover.zkeyHeader.curveName),
    },
    zkeySections: prover.zkeySections.map((section) =>
      Uint8Array.from(Buffer.from(section, 'base64')),
    ),
  };

  return processedProver;
}

/**
 * Retrieves the cryptographic curve configuration required for SnarkJS.
 *
 * @param name - The name of the curve
 * @returns The curve configuration object for SnarkJS
 */
async function getCurveForSnarkJS(name: string): Promise<any> {
  let curve;
  const validChars = name.toUpperCase().match(/[A-Za-z0-9]+/gu);
  if (!validChars) {
    throw new Error(`Invalid curve name '${name}'`);
  }
  const normalizedName = validChars.join('');
  if (['BN128', 'BN254', 'ALTBN128'].includes(normalizedName)) {
    curve = await buildBn128(true);
  } else if (['BLS12381'].includes(normalizedName)) {
    curve = await buildBls12381(true);
  } else {
    throw new Error(`Curve not supported: ${name}`);
  }
  return curve;
}

// Re-export these constants for tests
export { subPathWasm, subPathZkeyHeader, subPathZkeySections };

/**
 * Retrieves and verifies prover data from a given ProverLink.
 *
 * @param link - The prover link containing URL and hash
 * @returns The fetched and verified prover data
 */
async function fetchProverData(link: ProverLink): Promise<ProverData> {
  /**
   * Fetches JSON data from a URL with error handling.
   *
   * @param url - The URL to fetch from
   * @returns The parsed JSON data
   */
  async function fetchWithErrorHandling(url: string): Promise<any> {
    const potentialError = new Error(
      `Failed to fetch prover data from ${url} .`,
    );
    let response: any;
    try {
      response = await fetch(url);
    } catch {
      throw potentialError;
    }
    if (!response.ok) {
      throw potentialError;
    }
    try {
      return await response.json();
    } catch {
      throw potentialError;
    }
  }

  const wasm = await fetchWithErrorHandling(link.url + subPathWasm);
  const zkeyHeader = await fetchWithErrorHandling(link.url + subPathZkeyHeader);
  const zkSections = [] as any[];
  for (let i = 0; i < zkeyHeader.sectionsLength; i++) {
    const section = await fetchWithErrorHandling(
      link.url + subPathZkeySections(i),
    );
    zkSections.push(section);
  }
  delete zkeyHeader.sectionsLength;
  const prover: ProverData = { wasm, zkeyHeader, zkeySections: zkSections };
  if (MD5(prover) !== link.hash) {
    throw new Error('Prover data hash does not match hash in ProverLink.');
  }

  return prover;
}

/**
 * GenerateZkCertProof constructs and checks the zkCert proof.
 *
 * @param params - Parameters defining the proof to be generated.
 * @param zkCert - ZkCert to be used for the proof.
 * @param holder - Holder data needed to derive private proof inputs.
 * @param merkleProof - Merkle proof of the zkCert in the zkCert registry.
 * @returns Generated ZkCert proof.
 */
export async function generateZkCertProof(
  params: GenZkProofParams<ZkCertInputType>,
  zkCert: ZkCertificate<Record<string, unknown>>,
  holder: HolderData,
  merkleProof: MerkleProof,
): Promise<ZkCertProof> {
  const { inputs } = await prepareZkCertProofInputs(
    params,
    zkCert as any,
    holder.eddsaKey,
    merkleProof,
  );
  return generateProof(inputs, params.prover);
}

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
  proof: ZkCertProof,
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
