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
import { formatPrivKeyForBabyJub } from '@galactica-net/zk-certificates';
import { divider, heading, text } from '@metamask/snaps-ui';
import { Buffer } from 'buffer';
import { buildEddsa } from 'circomlibjs';
import { buildBls12381, buildBn128 } from 'ffjavascript';
import hash from 'object-hash';
import { groth16 } from 'snarkjs';

import type { HolderData, PanelContent } from './types';
import { stripURLProtocol } from './utils';

/**
 * GenerateZkCertProof constructs and checks the zkCert proof.
 * @param params - Parameters defining the proof to be generated.
 * @param zkCert - ZkCert to be used for the proof.
 * @param holder - Holder data needed to derive private proof inputs.
 * @param merkleProof - Merkle proof of the zkCert in the zkCert registry.
 * @returns Generated ZkCert proof.
 */
export const generateZkCertProof = async (
  params: GenZkProofParams<ZkCertInputType>,
  zkCert: ZkCertificate,
  holder: HolderData,
  merkleProof: MerkleProof,
): Promise<ZkCertProof> => {
  const authorizationProof = zkCert.getAuthorizationProofInput(
    holder.eddsaKey,
    params.userAddress,
  );

  const inputs: any = {
    ...params.input,

    ...zkCert.content,
    randomSalt: zkCert.randomSalt,
    expirationDate: zkCert.expirationDate,

    ...zkCert.getOwnershipProofInput(holder.eddsaKey),

    userAddress: authorizationProof.userAddress,
    s2: authorizationProof.s,
    r8x2: authorizationProof.r8x,
    r8y2: authorizationProof.r8y,

    providerAx: zkCert.providerData.ax,
    providerAy: zkCert.providerData.ay,
    providerS: zkCert.providerData.s,
    providerR8x: zkCert.providerData.r8x,
    providerR8y: zkCert.providerData.r8y,

    root: merkleProof.root,
    pathElements: merkleProof.pathElements,
    leafIndex: merkleProof.leafIndex,
  };

  if (params.zkInputRequiresPrivKey) {
    // Generate private key for sending encrypted messages to institutions
    // It should be different if the ZKP is sent from another address
    // Therefore generating it from the private holder eddsa key and the user address
    const eddsa = await buildEddsa();
    const encryptionHashBase = eddsa.poseidon.F.toObject(
      eddsa.poseidon([holder.eddsaKey, params.userAddress, zkCert.randomSalt]),
    ).toString();
    const encryptionPrivKey = formatPrivKeyForBabyJub(
      encryptionHashBase,
      eddsa,
    ).toString();

    inputs.userPrivKey = encryptionPrivKey;
  }

  return generateProof(inputs, params.prover);
};

/**
 * GenerateProof runs the low level groth16 proof generation.
 * @param inputs - Input data containing signals for the proof generation.
 * @param prover - Prover data containing the wasm and zkey header and sections.
 * @returns Generated ZkCert proof.
 */
export const generateProof = async (
  inputs: Record<string, any>,
  proverOrLink: ProverData | ProverLink,
): Promise<ZkCertProof> => {
  // get prover data from params or fetch it from a URL
  let prover: ProverData;
  if ('wasm' in proverOrLink) {
    prover = proverOrLink;
  } else {
    if (!('url' in proverOrLink)) {
      throw new GenZKPError({
        name: 'MissingInputParams',
        message: `ProverLink does not contain a URL.`,
      });
    }
    prover = await fetchProverData(proverOrLink as ProverLink);
  }

  const processedProver = await preprocessProver(prover);

  try {
    const { proof, publicSignals } = await groth16.fullProveMemory(
      inputs,
      processedProver.wasm,
      processedProver.zkeyHeader,
      processedProver.zkeySections,
    );

    // console.log('Calculated proof: ');
    // console.log(JSON.stringify(proof, null, 1));

    return { proof, publicSignals };
  } catch (error) {
    console.log('proof generation failed');
    console.log(error.stack);
    throw error;
  }
};

/**
 * Generate proof confirmation prompt for the user.
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
 * Prepares prover data from RPC request for snarkjs by converting it to the correct data types.
 * In the JSON message, arrays are base64 encoded.
 * @param prover - ProverData.
 * @returns Prepared ProverData.
 */
async function preprocessProver(prover: ProverData): Promise<ProverData> {
  // Somehow we need to convert them to Uint8Array to avoid an error inside snarkjs.
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

  /* eslint-disable-next-line require-atomic-updates */
  prover.zkeyHeader.curve = await getCurveForSnarkJS(
    prover.zkeyHeader.curveName,
  );

  return prover;
}

/**
 * Reconstruct curve from name for the snarkjs zkey header.
 * @param name - Name of the curve used for the ZKP.
 * @returns Curve object.
 */
async function getCurveForSnarkJS(name: string): Promise<any> {
  let curve;
  // normalize name
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

/**
 * Check validity of the ZKP generation request.
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

export const subPathWasm = 'wasm.json';
export const subPathZkeyHeader = 'zkeyHeader.json';
/**
 * Returns the sub path to the i-th zkey section.
 * @param i - Index of the zkey section.
 * @returns Sub path to the i-th zkey section.
 */
export function subPathZkeySections(i: number) {
  return `zkeySections/${i}.json`;
}

/**
 * Fetches prover data from a URL. It collects all parts of the prover and verifies the hash for security.
 * @param link - ProverLink containing the URL and hash of the prover data.
 * @returns ProverData.
 */
async function fetchProverData(link: ProverLink): Promise<ProverData> {
  /**
   * Helper for fetch with error handling.
   * @param url - URL to fetch from.
   * @returns JSON object response.
   */
  async function fetchWithErrorHandling(url: string) {
    const potentialError = new GenZKPError({
      name: 'ProverFetchFailed',
      message: `Failed to fetch prover data from ${url} .`,
    });
    let response: any;
    try {
      response = await fetch(url);
    } catch (error) {
      throw potentialError;
    }
    if (!response.ok) {
      throw potentialError;
    }
    try {
      return await response.json();
    } catch (error) {
      throw potentialError;
    }
  }

  const wasm = await fetchWithErrorHandling(link.url + subPathWasm);
  const zkeyHeader = await fetchWithErrorHandling(link.url + subPathZkeyHeader);

  const zkSections = [];
  for (let i = 0; i < zkeyHeader.sectionsLength; i++) {
    const section = await fetchWithErrorHandling(
      link.url + subPathZkeySections(i),
    );
    zkSections.push(section);
  }

  // delete sectionsLength parameter, because it is not included in the circom prover or hashing
  delete zkeyHeader.sectionsLength;

  const prover: ProverData = {
    wasm,
    zkeyHeader,
    zkeySections: zkSections,
  };

  if (hash.MD5(prover) !== link.hash) {
    throw new GenZKPError({
      name: 'MissingInputParams',
      message: `Prover data hash does not match hash in ProverLink.`,
    });
  }

  return prover;
}
