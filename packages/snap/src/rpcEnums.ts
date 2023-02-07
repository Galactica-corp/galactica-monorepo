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
  // TODO: would be nice to have more storage management methods like deleting a specific zkCert, modifying a zkCert, bulk import/export, ...
}

/**
 * Enum for string responses by the snap.
 */
export enum RpcResponseMsg {
  StorageCleared = 'zkCert storage cleared',
}

/**
 * Enum for string responses by the snap.
 */
export enum RpcResponseErr {
  Rejected = 'User rejected confirmation.',
  UnknownMethod = 'Method not found.',
  MissingHolder = 'No holders imported. Please import a holding address first.',
}