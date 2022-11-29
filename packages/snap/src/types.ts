import { ZkKYCContent } from "./zkCertTypes"


// requirements on the zk proof
export type ZkCertRequirements = {
    // identifier of the zkCert standard (e.g. zkKYC, zkDiploma, zkGymMembership, ...)
    zkCertStandard: string, 
}

/**
 * Parameter for requests to generate a zkKYC proof.
 */
export type GenZkKycRequestParams = {
    // public inputs that need to be proven
    input: {
        // TODO: fill in real parameters
        currentYear: string,
        currentMonth: string,
        currentDay: string,
        ageThreshold: string
    },
    requirements: ZkCertRequirements,
    wasm: Uint8Array,
    zkeyHeader: any,
    zkeySections: any[],
}

/**
 * Parameter for zkCert import.
 */
export type ImportRequestParams = {
    zkCert: ZkCert,
}

/**
 * Parameter for zkCert export.
 */
export type ExportRequestParams = {
    zkCertStandard: string,
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
    setupHoldingKey = "setupHoldingKey",
    genZkKycProof = 'genZkKycProof',
    clearStorage = 'clearStorage',
    importZkCert = 'importZkCert',
    exportZkCert = 'exportZkCert',
    // TODO: would be nice to have more storage management methods like deleting a specific zkCert, modifying a zkCert, bulk import/export, ...
}

/**
 * Enum for zkCert standards
 */
export enum ZkCertStandard {
    zkKYC = 'gip69',
}

export type ZkCert = {
    holder: string,
    holderCommitment: string,
    providerSignature: string,
    leafHash: string,
    did: string,
    contentHash: string,

    // identifier of the zkCert standard (e.g. zkKYC, zkDiploma, zkGymMembership, ...)
    zkCertStandard: ZkCertStandard, 
    // holding the data specific to the type of zkCert (e.g. zkKYCContent)
    content: ZkKYCContent | any, 
}

export type StorageState = {
    zkCerts: ZkCert[],
}
