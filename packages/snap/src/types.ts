import { ZkKYCContent } from "./zkCertTypes"

/**
 * Parameter for requests to generate a zkKYC proof.
 */
export type GenZkKycRequestParams = {
    // TODO: fill in real parameters
    input: {
        yearOfBirth: string,
        monthOfBirth: string,
        dayOfBirth: string,
        currentYear: string,
        currentMonth: string,
        currentDay: string,
        ageThreshold: string
    },
    wasm: Uint8Array,
    zkeyHeader: any,
    zkeySections: any[],
}

/**
 * zkCert proof to be reterned to the website.
 */
export type ZkCertProof = {
    proof: string,
    publicSignals: string[],
}

/**
 * Enum for RPC methods.
 */
export enum RpcMethods {
    genZkKycProof = 'genZkKycProof',
    clearStorage = 'clearStorage',
    importZkCert = 'importZkCert',
    exportZkCert = 'exportZkCert',
}

export type ZkCert = {
    holder: string,
    holderCommitment: string,
    providerSignature: string,
    leafHash: string,
    did: string,
    contentHash: string,

    // identifier of the zkCert standard (e.g. zkKYC, zkDiploma, zkGymMembership, ...)
    zkCertStandard: string, 
    // holding the data specific to the type of zkCert (e.g. zkKYCContent)
    content: ZkKYCContent | any, 
}

export type StorageState = {
    zkCerts: ZkCert[],
}
