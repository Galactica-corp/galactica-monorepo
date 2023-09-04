import { ZkCertStandard, ZkKYCContent } from './zkCertStandard';


/// Data required for ZK ownership proofs
export interface OwnershipProofInput {
    holderCommitment: string;
    // public key
    ax: string;
    ay: string;
    // signature
    s: string;
    r8x: string;
    r8y: string;
}

/// Data required for ZK authorization proofs
export interface AuthorizationProofInput {
    userAddress: string;
    // public key
    ax: string;
    ay: string;
    // signature
    s: string;
    r8x: string;
    r8y: string;
}

/// Data required for ZK fraud proofs
export interface ProviderData {
    // public eddsa key of provider
    ax: string;
    ay: string;
    // signature of the zkCert content hash by the provider
    s: string;
    r8x: string;
    r8y: string;
}

/// Data required for ZK fraud proofs
export interface FraudInvestigationDataEncryptionProofInput {
    userPrivKey: string;
    userPubKey: string[];

    investigationInstitutionPubkey: string[];
    encryptedData: string[];
}

/// Data required for a ZK proof of someone's DApp specific HumanID
export interface HumanIDProofInput {
    passportID: string;
    dAppAddress: string;
    humanID: string;
}

/// Data contained in a ZK certificate
export interface ZkCertData {
    holderCommitment: string;
    // identifier of the zkCert standard (e.g. zkKYC, zkDiploma, zkGymMembership, ...)
    zkCertStandard: ZkCertStandard;
    randomSalt: number;
    content: ZkKYCContent | Record<string, any>;
    providerData: ProviderData;
    contentHash: string;
    leafHash: string;
    did: string;
}
