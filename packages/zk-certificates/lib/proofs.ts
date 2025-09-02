/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import type {
  EddsaPrivateKey,
  MerkleProof,
} from '@galactica-net/galactica-types';
import type {
  GenZkProofParams,
  ProverData,
  ProverLink,
  ZkCertInputType,
  ZkCertProof,
} from '@galactica-net/snap-api';
import { Buffer } from 'buffer';
import { buildEddsa } from 'circomlibjs';
import { buildBls12381, buildBn128 } from 'ffjavascript';
import { MD5 } from 'object-hash';
import { groth16 } from 'snarkjs';

import { getMerkleRootFromProof, prepareContentForCircuit } from '.';
import { formatPrivKeyForBabyJub } from './keyManagement';
import type { ZkCertificate } from './zkCertificate';

export type PreparedZkCertProofInputs = { inputs: Record<string, unknown> };

/**
 * Prepares the input object required to generate a zero-knowledge certificate proof.
 *
 * @param params - The parameters for generating zero-knowledge proof, including user-specific and input-specific details.
 * @param zkCert - The zero-knowledge certificate containing necessary proof information and metadata.
 * @param holderEddsaKey - The private key of the certificate holder used for authorization and proof creation.
 * @param merkleProof - The Merkle proof containing the path elements and leaf index for verification of data integrity within a Merkle tree.
 * @returns A promise resolving to an object containing the prepared proof inputs required for ZK proof generation.
 */
export async function prepareZkCertProofInputs(
  params: GenZkProofParams<ZkCertInputType>,
  zkCert: ZkCertificate<Record<string, unknown>>,
  holderEddsaKey: EddsaPrivateKey,
  merkleProof: MerkleProof,
): Promise<PreparedZkCertProofInputs> {
  const authorizationProof = zkCert.getAuthorizationProofInput(
    holderEddsaKey,
    params.userAddress,
  );
  const eddsa = await buildEddsa();
  const merkleRoot = getMerkleRootFromProof(merkleProof, eddsa.poseidon);

  const inputs: any = {
    ...params.input,

    ...prepareContentForCircuit(eddsa, zkCert.content, zkCert.contentSchema),
    randomSalt: zkCert.randomSalt,
    expirationDate: zkCert.expirationDate,

    ...zkCert.getOwnershipProofInput(holderEddsaKey),

    userAddress: authorizationProof.userAddress,
    s2: authorizationProof.s,
    r8x2: authorizationProof.r8x,
    r8y2: authorizationProof.r8y,

    providerAx: zkCert.providerData.ax,
    providerAy: zkCert.providerData.ay,
    providerS: zkCert.providerData.s,
    providerR8x: zkCert.providerData.r8x,
    providerR8y: zkCert.providerData.r8y,

    root: merkleRoot,
    pathElements: merkleProof.pathElements,
    leafIndex: merkleProof.leafIndex,
  };

  if (params.zkInputRequiresPrivKey) {
    const encryptionHashBase = eddsa.poseidon.F.toObject(
      eddsa.poseidon([
        new Uint8Array(holderEddsaKey),
        params.userAddress,
        zkCert.randomSalt,
      ]),
    ).toString();

    inputs.userPrivKey = formatPrivKeyForBabyJub(
      encryptionHashBase,
      eddsa,
    ).toString();
  }

  return { inputs };
}

/**
 * Generates a zero-knowledge proof using the provided inputs and prover information.
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
 * Generates a zero-knowledge certificate proof based on the provided parameters and inputs.
 *
 * @param params - The parameters required for generating the proof, including prover information.
 * @param zkCert - The zero-knowledge certificate containing the required data for proof generation.
 * @param holderEddsaKey - The private key of the EDDSA holder used for signature generation during the proof creation process.
 * @param merkleProof - The Merkle proof associated with the zero-knowledge certificate to verify its validity.
 * @returns A promise that resolves to the generated zero-knowledge certificate proof.
 */
export async function generateZkCertProof(
  params: GenZkProofParams<ZkCertInputType>,
  zkCert: ZkCertificate<Record<string, unknown>>,
  holderEddsaKey: EddsaPrivateKey,
  merkleProof: MerkleProof,
): Promise<ZkCertProof> {
  const { inputs } = await prepareZkCertProofInputs(
    params,
    zkCert,
    holderEddsaKey,
    merkleProof,
  );
  return generateProof(inputs, params.prover);
}

/**
 * Transforms and preprocesses the provided ProverData object by decoding
 * base64-encoded fields, converting strings to BigInt where applicable,
 * and fetching the required curve information for SnarkJS.
 *
 * @param prover - The input ProverData object containing
 * base64-encoded data and other relevant fields to be preprocessed.
 * @returns A promise that resolves to the modified
 * and preprocessed ProverData object.
 */
async function preprocessProver(prover: ProverData): Promise<ProverData> {
  prover.wasm = Uint8Array.from(Buffer.from(prover.wasm, 'base64'));
  prover.zkeyHeader.q = BigInt(prover.zkeyHeader.q);
  prover.zkeyHeader.r = BigInt(prover.zkeyHeader.r);
  for (let i = 0; i < prover.zkeySections.length; i++) {
    prover.zkeySections[i] = Uint8Array.from(
      Buffer.from(prover.zkeySections[i], 'base64'),
    );
  }
  prover.zkeyHeader.vk_alpha_1 = Uint8Array.from(
    Buffer.from(prover.zkeyHeader.vk_alpha_1, 'base64'),
  );
  prover.zkeyHeader.vk_beta_1 = Uint8Array.from(
    Buffer.from(prover.zkeyHeader.vk_beta_1, 'base64'),
  );
  prover.zkeyHeader.vk_beta_2 = Uint8Array.from(
    Buffer.from(prover.zkeyHeader.vk_beta_2, 'base64'),
  );
  prover.zkeyHeader.vk_gamma_2 = Uint8Array.from(
    Buffer.from(prover.zkeyHeader.vk_gamma_2, 'base64'),
  );
  prover.zkeyHeader.vk_delta_1 = Uint8Array.from(
    Buffer.from(prover.zkeyHeader.vk_delta_1, 'base64'),
  );
  prover.zkeyHeader.vk_delta_2 = Uint8Array.from(
    Buffer.from(prover.zkeyHeader.vk_delta_2, 'base64'),
  );
  prover.zkeyHeader.curve = await getCurveForSnarkJS(
    prover.zkeyHeader.curveName,
  );
  return prover;
}

/**
 * Retrieves the cryptographic curve configuration required for SnarkJS
 * based on the provided curve name.
 *
 * @param name - The name of the curve to retrieve. Valid curve names include
 * 'BN128', 'BN254', 'ALTBN128', and 'BLS12381'.
 * The input is case-insensitive and sanitized before processing.
 * @returns A Promise resolving to the configuration object of the
 * specified cryptographic curve. If the curve is not supported,
 * or the name contains invalid characters, an error is thrown.
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

export const subPathWasm = 'wasm.json';
export const subPathZkeyHeader = 'zkeyHeader.json';

/**
 * Constructs a file path string for a zkey section based on the provided index.
 *
 * @param i - The index used to generate the zkey section path.
 * @returns A string representing the file path for the zkey section.
 */
export function subPathZkeySections(i: number) {
  return `zkeySections/${i}.json`;
}

/**
 * Retrieves and verifies prover data from a given ProverLink.
 *
 * @param link An object containing the URL and hash to fetch and validate prover data.
 * @returns A promise that resolves with the fetched and verified prover data.
 */
async function fetchProverData(link: ProverLink): Promise<ProverData> {
  /**
   * Fetches data from the specified URL with error handling mechanisms to manage potential issues during the fetch or JSON parsing processes.
   *
   * @param url - The URL to fetch data from.
   * @returns - A promise that resolves to the parsed JSON response, or rejects with an error if the fetch or parsing fails.
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
