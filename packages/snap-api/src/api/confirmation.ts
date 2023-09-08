/**
 * Interface for returning a confirmation response on successful requests without another return type.
 */
export type ConfirmationResponse = {
  message: RpcResponseMsg;
};

/**
 * Enum for string responses by the snap.
 */
export enum RpcResponseMsg {
  StorageCleared = 'zkCert storage cleared',
  ZkCertImported = 'zkCert added to storage',
  MerkleProofsUpdated = 'Updated Merkle proofs',
  ZkCertAlreadyImported = 'This zkCert has already been imported. Skipping it.',
  ZkCertDeleted = 'Deleted zkCert.',
}
