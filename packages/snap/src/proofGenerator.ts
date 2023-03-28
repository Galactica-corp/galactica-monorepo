import { Buffer } from 'buffer';
import { groth16 } from 'snarkjs';
import { MerkleProof, ZKCertificate } from 'zkkyc';
import { buildBn128, buildBls12381 } from 'ffjavascript';

import { GenZkKycRequestParams, ZkCertProof, HolderData } from './types';

/**
 * GenerateZkKycProof constructs and checks the zkKYC proof.
 *
 * @param params - Parameters defining the proof to be generated.
 * @param zkCert - ZkCert to be used for the proof.
 * @param holder - Holder data needed to derive private proof inputs.
 * @param merkleProof - Merkle proof of the zkCert in the zkCert registry.
 */
export const generateZkKycProof = async (
  params: GenZkKycRequestParams,
  zkCert: ZKCertificate,
  holder: HolderData,
  merkleProof: MerkleProof,
): Promise<ZkCertProof> => {
  const processedParams = await preprocessInput(params);

  const authorizationProof = zkCert.getAuthorizationProofInput(
    holder.eddsaKey,
    // TODO: add selection of the using wallet
    holder.address,
  );

  const inputs: any = {
    ...processedParams.input,

    ...zkCert.fields,
    randomSalt: zkCert.randomSalt,

    ...zkCert.getOwnershipProofInput(holder.eddsaKey),

    // TODO: accept authorization for different address than holder
    userAddress: authorizationProof.userAddress,
    S2: authorizationProof.S,
    R8x2: authorizationProof.R8x,
    R8y2: authorizationProof.R8y,

    providerAx: zkCert.providerData.Ax,
    providerAy: zkCert.providerData.Ay,
    providerS: zkCert.providerData.S,
    providerR8x: zkCert.providerData.R8x,
    providerR8y: zkCert.providerData.R8y,

    root: merkleProof.root,
    pathElements: merkleProof.path,
    pathIndices: merkleProof.pathIndices,

    // TODO: add selection of the using wallet
    userPrivKey: holder.eddsaKey,

    humanID: zkCert.getHumanID(processedParams.input.dAppAddress),
  };

  console.log('proof inputs: TODO: remove this debug output');
  console.log(JSON.stringify(inputs, null, 1));

  try {
    const { proof, publicSignals } = await groth16.fullProveMemory(
      inputs,
      processedParams.wasm,
      processedParams.zkeyHeader,
      processedParams.zkeySections,
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
 * Prepare data from RPC request for snarkjs by converting it to the correct data types.
 * In the JSON message, arrays are base64 encoded.
 *
 * @param params - GenZkKycRequestParams.
 * @returns Prepared GenZkKycRequestParams.
 */
async function preprocessInput(params: GenZkKycRequestParams): Promise<GenZkKycRequestParams> {
  // Somehow we need to convert them to Uint8Array to avoid an error inside snarkjs.
  params.wasm = Uint8Array.from(Buffer.from(params.wasm, 'base64'));

  params.zkeyHeader.q = BigInt(params.zkeyHeader.q);
  params.zkeyHeader.r = BigInt(params.zkeyHeader.r);
  for (let i = 0; i < params.zkeySections.length; i++) {
    params.zkeySections[i] = Uint8Array.from(
      Buffer.from(params.zkeySections[i], 'base64'),
    );
  }
  params.zkeyHeader.vk_alpha_1 = Uint8Array.from(
    Buffer.from(params.zkeyHeader.vk_alpha_1, 'base64'),
  );
  params.zkeyHeader.vk_beta_1 = Uint8Array.from(
    Buffer.from(params.zkeyHeader.vk_beta_1, 'base64'),
  );
  params.zkeyHeader.vk_beta_2 = Uint8Array.from(
    Buffer.from(params.zkeyHeader.vk_beta_2, 'base64'),
  );
  params.zkeyHeader.vk_gamma_2 = Uint8Array.from(
    Buffer.from(params.zkeyHeader.vk_gamma_2, 'base64'),
  );
  params.zkeyHeader.vk_delta_1 = Uint8Array.from(
    Buffer.from(params.zkeyHeader.vk_delta_1, 'base64'),
  );
  params.zkeyHeader.vk_delta_2 = Uint8Array.from(
    Buffer.from(params.zkeyHeader.vk_delta_2, 'base64'),
  );

  console.log(`generatign curve`);
  params.zkeyHeader.curve = await getCurveForSnarkJS(params.zkeyHeader.curveName);

  const l1 = Object.keys(params.zkeyHeader.curve);
  console.log(`curve: ${l1}`);
  for (let i = 0; i < l1.length; i++) {
    const l2 = Object.keys(params.zkeyHeader.curve[l1[i]]);
    console.log(`curve.${l1[i]}: ${l2}`);
  }

  return params;
}

/// TODO: docstring
async function getCurveForSnarkJS(name: string): Promise<any> {
  let curve;
  const normalizedName = name.toUpperCase().match(/[A-Za-z0-9]+/g)!.join("");
  if (["BN128", "BN254", "ALTBN128"].indexOf(normalizedName) >= 0) {
    curve = await buildBn128(true);
  } else if (["BLS12381"].indexOf(normalizedName) >= 0) {
    curve = await buildBls12381(true);
  } else {
    throw new Error(`Curve not supported: ${name}`);
  }
  return curve;
}
