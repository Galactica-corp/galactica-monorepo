export {
  ZkCertStandard,
  ProviderData,
  MerkleProof,
  ZkCertData,
} from '@galactica-net/galactica-types';
import { MerkleProof, ZkCertData } from '@galactica-net/galactica-types';

export interface ZkCertRegistered extends ZkCertData {
  // Proof showing that the zkCert is part of the Merkle tree
  // Updating it helps to prevent tracking through finding uses of the same merkle root
  merkleProof: MerkleProof;
};

/**
 * Data defining a zk circuit prover
 */
export interface ProverData {
  // Prover code in web assembly that will be used to generate the proof in the Snap.
  wasm: any;
  // Corresponding parameters from the zkey file (SNARK trusted setup ceremony). The binary fields are base64 encoded.
  zkeyHeader: any;
  // Array of base64 encoded zkey sections used by snarkjs. The binary fields are base64 encoded.
  zkeySections: any[];
};
