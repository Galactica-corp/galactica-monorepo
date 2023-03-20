/**
 * Enum for RPC methods.
 */
export enum RpcMethods {
  SetupHoldingKey = 'setupHoldingKey',
  GetHolderCommitment = 'getHolderCommitment',
  GenZkKycProof = 'genZkKycProof',
  ClearStorage = 'clearStorage',
  ImportZkCert = 'importZkCert',
  ExportZkCert = 'exportZkCert',
  ListZkCerts = 'listZkCerts',
  GetZkCertStorageHashes = 'getZkCertStorageHashes',
  // TODO: would be nice to have more storage management methods like deleting a specific zkCert, modifying a zkCert, bulk import/export, ...
}

/**
 * Enum for string responses by the snap.
 */
export enum RpcResponseMsg {
  StorageCleared = 'zkCert storage cleared',
  ZkCertImported = 'zkCert added to storage',
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
