import { GenZkKycRequestParams, ZkCertProof } from "./types";
import { groth16 } from "snarkjs";


/**
 * generateZkKycProof constructs and checks the zkKYC proof
 */
export const generateZkKycProof = async (params: GenZkKycRequestParams): Promise<ZkCertProof> => {
    params = preprocessInput(params);

    const { proof, publicSignals } = await groth16.fullProveMemory(params.input, Uint8Array.from(params.wasm), params.zkeyHeader, params.zkeySections)

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
