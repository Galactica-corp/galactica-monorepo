export type ZkCertStandard = "gip69";

export type ProviderData = {
  // public eddsa key of provider
  Ax: string;
  Ay: string;
  // signature of the zkCert content hash by the provider
  S: string;
  R8x: string;
  R8y: string;
};

export type MerkleProof = {
  leaf: string;
  // hashes of the branches on the side of the path
  pathElements: string[];
  // interpreted as binary number. If a bit is set, it means that the path is the right part of the parent node.
  pathIndices: number;
  root: string;
};

export type ZkCert = {
  holderCommitment: string;
  providerSignature: string;
  leafHash: string;
  did: string;
  contentHash: string;
  randomSalt: number;
  providerData: ProviderData;

  // identifier of the zkCert standard (e.g. zkKYC, zkDiploma, zkGymMembership, ...)
  zkCertStandard: ZkCertStandard;
  // holding the data specific to the type of zkCert (e.g. zkKYCContent)
  // TODO: should be type
  content: any;

  // Proof showing that the zkCert is part of the Merkle tree
  // Updating it helps to prevent tracking through finding uses of the same merkle root
  merkleProof: MerkleProof;
};
