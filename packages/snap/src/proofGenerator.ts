import { GenZkKycRequestParams, ZkCertProof, HolderData } from "./types";
import { groth16 } from "snarkjs";
import { MerkleProof, ZKCertificate, fromHexToDec } from "zkkyc";


/**
 * generateZkKycProof constructs and checks the zkKYC proof
 * @param params Parameters defining the proof to be generated
 * @param zkCert zkCert to be used for the proof
 * @param holder holder data needed to derive private proof inputs
 */
export const generateZkKycProof = async (params: GenZkKycRequestParams, zkCert: ZKCertificate, holder: HolderData, merkleProof: MerkleProof): Promise<ZkCertProof> => {
    params = preprocessInput(params);

    const authorizationProof = zkCert.getAuthorizationProofInput(holder.eddsaKey, holder.address);

    const inputs: any = {
        ...params.input,
        
        ...zkCert.fields,
        randomSalt: zkCert.randomSalt,

        ...zkCert.getOwnershipProofInput(holder.eddsaKey),
        // TODO: accept authorization for different address than holder

        // TODO: this line seems to cause some assert to fail in snarkjs
        userAddress: fromHexToDec(authorizationProof.userAddress),
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
    };

    console.log("proof inputs: TODO: remove this debug output");
    console.log(JSON.stringify(inputs, null, 1));

    Object.keys(inputs).forEach(key => {
        console.log(key, inputs[key]);
    });

    try {
        const { proof, publicSignals } = await groth16.fullProveMemory(inputs, Uint8Array.from(params.wasm), params.zkeyHeader, params.zkeySections)

        console.log("Calculated proof: ");
        console.log(JSON.stringify(proof, null, 1));
    
        return { proof: proof, publicSignals: publicSignals };
    }
    catch (err) {
        console.log("proof generation failed");
        console.log(err.stack);
        throw err;
    }
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
