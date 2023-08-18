import { invokeSnap } from "../utils/invoke-snap";
import { ZkCertStandard } from "./types";

export type GenZkKycProofParams = {
  // An object, containing public ZKP input for the statements to be shown by the generated proof.
  // TODO: type it
  input: object;

  requirements: {
    // For the standard of the zkCertificate that should be used for the proof.
    zkCertStandard: ZkCertStandard;
  };
  // string base64 encoded wasm binary of the prover.
  wasm: string;

  // Object of zkey headers used by snarkjs. The binary fields are base64 encoded.
  // TODO: type it
  zkeyHeader: object;

  // Array of base64 encoded zkey sections used by snarkjs.
  zkeySections: string[];

  // String with the account address the user is going to use to submit the proof.
  userAddress: string;

  // Description of disclosures made by the proof.
  disclosureDescription?: string;
};

export type GenZkKycProofResponse = any;

/**
 * Sends a request for generating a ZK proof in the Snap
 */
export const genZkKycProof = async (params: GenZkKycProofParams) => {
  const response: GenZkKycProofResponse = await invokeSnap({
    method: "genZkKycProof",
    params,
  });

  return response;
};
