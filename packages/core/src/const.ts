// / Field used for EdDSA signatures.
export const eddsaPrimeFieldMod =
  '2736030358979909402780800718157159386076813972158567259200215660948447373040';

// / String message used to derive an EdDSA keypair from an Ethereum signature
export const eddsaKeyGenerationMessage =
  'Signing this message generates your EdDSA private key. Only do this on pages you trust to manage your zkCertificates.';

// / Prime field used for zero-knowledge snarks.
export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const galacticaMethods = [
  'genZkKycProof',
  'clearStorage',
  'importZkCert',
  'exportZkCert',
  'getHolderCommitment',
  'listZkCerts',
  'getZkCertStorageHashes',
  'updateMerkleProof',
  'deleteZkCert',
  'getZkCertHashes',
] as const;

export type GalacticaMethod = typeof galacticaMethods[number];
