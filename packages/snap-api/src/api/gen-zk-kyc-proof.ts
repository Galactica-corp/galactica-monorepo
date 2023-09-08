import { GalacticaErrorBase } from './error';
import { RpcMethods } from './rpcEnums';
import { ZkCertStandard, ProverData, ZkCertProof } from './types';
import { ZkCertInputType } from './zkpInputTypes';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Parameter for requests to generate a ZK proof with the Galactica Snap.
 */
export type GenZkProofParams<ProofInputType> = {
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

type GenZKPErrorName = 'MissingInputParams';

export class GenZKPError extends GalacticaErrorBase<GenZKPErrorName> {}

/**
 * GenerateZKProof prepares and executes the call to generate a ZKP in the Galactica snap.
 * You can use it to generate various kinds of proofs, depending on the input you pass.
 *
 * @param params - The parameters required to generate a ZKP in the Snap.
 * @returns Request result with the ZK proof or error.
 * @throws RPCError on failure.
 */
export const generateZKProof = async (
  params: GenZkProofParams<ZkCertInputType>,
) => {
  const response: ZkCertProof = await invokeSnap({
    method: RpcMethods.GenZkKycProof,
    params,
  });

  return response;
};
