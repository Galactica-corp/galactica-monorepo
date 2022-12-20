import { GenZkKycRequestParams, ZkCertProof, HolderData } from "./types";
import { groth16 } from "snarkjs";
import { ZKCertificate } from "zkkyc";


/**
 * generateZkKycProof constructs and checks the zkKYC proof
 * @param params Parameters defining the proof to be generated
 * @param zkCert zkCert to be used for the proof
 * @param holder holder data needed to derive private proof inputs
 */
export const generateZkKycProof = async (params: GenZkKycRequestParams, zkCert: ZKCertificate, holder: HolderData): Promise<ZkCertProof> => {
    params = preprocessInput(params);

    const inputs = {
        ...params.input,
        ...zkCert.fields,
        ...zkCert.getOwnershipProofInput(holder.eddsaKey),
        // TODO: accept authorization for different address than holder
        ...zkCert.getAuthorizationProofInput(holder.eddsaKey, holder.address),
    };

    console.log("proof inputs: TODO: remove this debug output", inputs);

    const { proof, publicSignals } = await groth16.fullProveMemory(inputs, Uint8Array.from(params.wasm), params.zkeyHeader, params.zkeySections)

    console.log("Calculated proof: ");
    console.log(JSON.stringify(proof, null, 1));

    return { proof: proof, publicSignals: publicSignals };
}

/**
 * @description Prepare data from RPC request for snarkjs by converting it to the correct data types
 * @param params GenZkKycRequestParams
 * @returns prepared GenZkKycRequestParams
 */
function preprocessInput(params: GenZkKycRequestParams): GenZkKycRequestParams {
    params.zkeyHeader.q = BigInt(params.zkeyHeader.q);
    params.zkeyHeader.r = BigInt(params.zkeyHeader.r);
    for (let i = 0; i < params.zkeySections.length; i++) {
        params.zkeySections[i] = Uint8Array.from(params.zkeySections[i]);
    }
    params.zkeyHeader.vk_alpha_1 = Uint8Array.from(params.zkeyHeader.vk_alpha_1)
    params.zkeyHeader.vk_beta_1 = Uint8Array.from(params.zkeyHeader.vk_beta_1)
    params.zkeyHeader.vk_beta_2 = Uint8Array.from(params.zkeyHeader.vk_beta_2)
    params.zkeyHeader.vk_gamma_2 = Uint8Array.from(params.zkeyHeader.vk_gamma_2)
    params.zkeyHeader.vk_delta_1 = Uint8Array.from(params.zkeyHeader.vk_delta_1)
    params.zkeyHeader.vk_delta_2 = Uint8Array.from(params.zkeyHeader.vk_delta_2)

    return params;
}
