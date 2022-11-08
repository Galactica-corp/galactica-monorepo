import { GenZkKycRequestParams, ZkCertProof } from "./types";


/**
 * generateZkKycProof constructs and checks the zkKYC proof
 */
export const generateZkKycProof = async (params: GenZkKycRequestParams): Promise<ZkCertProof> => {
    // TODO: integrate snarkJS
    // TODO: return proper proof data
    return { proof: "proof" };
}