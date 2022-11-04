/**
 * Parameter for requests to generate a zkKYC proof.
 */
export type GenZkKycRequestParams = {
    // TODO: fill in real parameters
    expirationDate: string;
}

/**
 * zkCert proof to be reterned to the website.
 */
export type ZkCertProof = {
    proof: string;
}

/**
 * Enum for RPC methods.
 */
export enum RpcMethods {
    genZkKycProof = 'genZkKycProof',
}