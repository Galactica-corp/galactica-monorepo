// SPDX-License-Identifier: BUSL-1.1
import type { MerkleProof } from '@galactica-net/galactica-types';
import { ZkCertStandard } from '@galactica-net/galactica-types';
import type {
  GenZkProofParams,
  ZkCertInputType,
  ZkCertProof,
} from '@galactica-net/snap-api';
import { GenZKPError } from '@galactica-net/snap-api';
import type { ZKCertificate } from '@galactica-net/zk-certificates';
import { formatPrivKeyForBabyJub } from '@galactica-net/zk-certificates';
import { divider, heading, text } from '@metamask/snaps-ui';
import { Buffer } from 'buffer';
import { buildEddsa } from 'circomlibjs';
import { buildBls12381, buildBn128 } from 'ffjavascript';
import { groth16 } from 'snarkjs';

import type { HolderData, PanelContent } from './types';

/**
 * GenerateZkKycProof constructs and checks the zkKYC proof.
 * @param params - Parameters defining the proof to be generated.
 * @param zkCert - ZkCert to be used for the proof.
 * @param holder - Holder data needed to derive private proof inputs.
 * @param merkleProof - Merkle proof of the zkCert in the zkCert registry.
 * @returns Generated ZKKYC proof.
 */
export const generateZkKycProof = async (
  params: GenZkProofParams<ZkCertInputType>,
  zkCert: ZKCertificate,
  holder: HolderData,
  merkleProof: MerkleProof,
): Promise<ZkCertProof> => {
  const processedParams = await preprocessInput(params);

  const authorizationProof = zkCert.getAuthorizationProofInput(
    holder.eddsaKey,
    params.userAddress,
  );

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

  const inputs: any = {
    ...processedParams.input,

    ...zkCert.content,
    randomSalt: zkCert.randomSalt,

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

    userPrivKey: encryptionPrivKey,

    humanID: zkCert.getHumanID(processedParams.input.dAppAddress),
  };

  try {
    const { proof, publicSignals } = await groth16.fullProveMemory(
      inputs,
      processedParams.prover.wasm,
      processedParams.prover.zkeyHeader,
      processedParams.prover.zkeySections,
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

export const generateTwitterFollowersThresholdProof = async (
  params: GenZkProofParams<ZkCertInputType>,
  zkCert: ZKCertificate,
  holder: HolderData,
  merkleProof: MerkleProof,
): Promise<ZkCertProof> => {
  const processedParams = await preprocessInput(params);

  const authorizationProof = zkCert.getAuthorizationProofInput(
    holder.eddsaKey,
    params.userAddress,
  );

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

  const inputs: any = {
    ...processedParams.input,

    ...zkCert.content,
    randomSalt: zkCert.randomSalt,

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

    userPrivKey: encryptionPrivKey,
  };

  try {
    const { proof, publicSignals } = await groth16.fullProveMemory(
      inputs,
      processedParams.prover.wasm,
      processedParams.prover.zkeyHeader,
      processedParams.prover.zkeySections,
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
      `With this action you will create a ${params.requirements.zkCertStandard.toUpperCase()} proof for ${origin}.
       This action tests whether your personal data fulfills the requirements of the proof.`,
    ),
    divider(),
  ];

  // Description of disclosures made by the proof have to be provided by the front-end because the snap can not analyze what the prover will do.
  if (params.description) {
    proofConfirmDialog.push(
      text(`Description of the proof (provided by ${origin}):`),
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
 * Prepare data from RPC request for snarkjs by converting it to the correct data types.
 * In the JSON message, arrays are base64 encoded.
 * @param params - GenZkKycRequestParams.
 * @returns Prepared GenZkKycRequestParams.
 */
async function preprocessInput(
  params: GenZkProofParams<ZkCertInputType>,
): Promise<GenZkProofParams<ZkCertInputType>> {
  // Somehow we need to convert them to Uint8Array to avoid an error inside snarkjs.
  params.prover.wasm = Uint8Array.from(
    Buffer.from(params.prover.wasm, 'base64'),
  );

  params.prover.zkeyHeader.q = BigInt(params.prover.zkeyHeader.q);
  params.prover.zkeyHeader.r = BigInt(params.prover.zkeyHeader.r);
  for (let i = 0; i < params.prover.zkeySections.length; i++) {
    params.prover.zkeySections[i] = Uint8Array.from(
      Buffer.from(params.prover.zkeySections[i], 'base64'),
    );
  }
  params.prover.zkeyHeader.vk_alpha_1 = Uint8Array.from(
    Buffer.from(params.prover.zkeyHeader.vk_alpha_1, 'base64'),
  );
  params.prover.zkeyHeader.vk_beta_1 = Uint8Array.from(
    Buffer.from(params.prover.zkeyHeader.vk_beta_1, 'base64'),
  );
  params.prover.zkeyHeader.vk_beta_2 = Uint8Array.from(
    Buffer.from(params.prover.zkeyHeader.vk_beta_2, 'base64'),
  );
  params.prover.zkeyHeader.vk_gamma_2 = Uint8Array.from(
    Buffer.from(params.prover.zkeyHeader.vk_gamma_2, 'base64'),
  );
  params.prover.zkeyHeader.vk_delta_1 = Uint8Array.from(
    Buffer.from(params.prover.zkeyHeader.vk_delta_1, 'base64'),
  );
  params.prover.zkeyHeader.vk_delta_2 = Uint8Array.from(
    Buffer.from(params.prover.zkeyHeader.vk_delta_2, 'base64'),
  );

  /* eslint-disable-next-line require-atomic-updates */
  params.prover.zkeyHeader.curve = await getCurveForSnarkJS(
    params.prover.zkeyHeader.curveName,
  );

  return params;
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
export function checkZkKycProofRequest(
  params: GenZkProofParams<ZkCertInputType>,
) {
  if (params.userAddress === undefined) {
    throw new GenZKPError({
      name: 'MissingInputParams',
      message: `userAddress missing in request parameters.`,
    });
  }
  if (params.requirements.zkCertStandard !== ZkCertStandard.ZkKYC) {
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
  if (params.prover === undefined || params.prover.wasm === undefined) {
    throw new GenZKPError({
      name: 'MissingInputParams',
      message: `Missing prover data.`,
    });
  }
}

/**
 * Check validity of the ZKP generation request.
 * @param params - Parameters defining the proof to be generated.
 * @throws an error if the request is invalid.
 */
export function checkTwitterFollowersThresholdProofRequest(
  params: GenZkProofParams<ZkCertInputType>,
) {
  if (params.userAddress === undefined) {
    throw new GenZKPError({
      name: 'MissingInputParams',
      message: `userAddress missing in request parameters.`,
    });
  }
  if (
    params.requirements.zkCertStandard !== ZkCertStandard.TwitterZkCertificate
  ) {
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
  if (params.prover === undefined || params.prover.wasm === undefined) {
    throw new GenZKPError({
      name: 'MissingInputParams',
      message: `Missing prover data.`,
    });
  }
}
