// SPDX-License-Identifier: BUSL-1.1
/**
 * Enum for RPC methods.
 */
export enum RpcMethods {
  GetHolderCommitment = 'getHolderCommitment',
  GenZkKycProof = 'genZkKycProof',
  ClearStorage = 'clearStorage',
  ImportZkCert = 'importZkCert',
  ExportZkCert = 'exportZkCert',
  ListZkCerts = 'listZkCerts',
  GetZkCertStorageHashes = 'getZkCertStorageHashes',
  GetZkCertHash = 'getZkCertHashes',
  UpdateMerkleProof = 'updateMerkleProof',
  UpdateMerkleProofURL = 'updateMerkleProofURL',
  DeleteZkCert = 'deleteZkCert',
}

/**
 * Enum for string responses by the snap.
 */
export enum RpcResponseErr {
  RejectedConfirm = 'User rejected confirmation.',
  UnknownMethod = 'Method not found.',
  MissingHolder = 'No holders imported. Please import a holding address first.',
  RejectedConnect = 'User rejected the request.',
  RejectedSignature = 'User denied message signature.',
  RejectedSelect = 'User did not choose a zkCertificate.',
}
