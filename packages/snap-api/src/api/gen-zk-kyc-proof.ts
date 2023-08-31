import { invokeSnap } from '../utils/invoke-snap';
import { RpcMethods } from './rpcEnums';
import { ZkCertStandard, ProverData } from './types';
import { ZkCertInputType } from './zkpInputTypes';


/**
 * Parameter for requests to generate a zkKYC proof.
 */
export interface GenZkKycProofParams<ProofInputType> {
  // An object, containing public ZKP input for the statements to be shown by the generated proof.
  input: ProofInputType;

  requirements: {
    // For the standard of the zkCertificate that should be used for the proof.
    zkCertStandard: ZkCertStandard;
  };

  // Prover to generate the ZKP.
  prover: ProverData;

  // String with the account address the user is going to use to submit the proof.
  userAddress: string;

  // Description of disclosures made by the proof.
  disclosureDescription?: string;
};

export type GenZkKycProofResponse = any;

/**
 * Sends a request for generating a ZK proof in the Snap.
 *
 * @param params - The parameters required to generate a ZKP in the Snap.
 */
export const genZkKycProof = async (params: GenZkKycProofParams<ZkCertInputType>) => {
  const response: GenZkKycProofResponse = await invokeSnap({
    method: RpcMethods.GenZkKycProof,
    params,
  });

  return response;
};
