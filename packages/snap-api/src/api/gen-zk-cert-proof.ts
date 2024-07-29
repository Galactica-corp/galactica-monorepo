import { GalacticaErrorBase } from './error';
import { RpcMethods } from './rpcEnums';
import type { ZkCertStandard, ProverData, ZkCertProof, ProverLink } from './types';
import type { ZkCertInputType } from './zkpInputTypes';
import { sdkConfig } from '../config';
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
    // EVM address where the zkCertificate is registered.
    registryAddress: string;
  };

  // Prover to generate the ZKP.
  prover: ProverData | ProverLink;

  // String with the account address the user is going to use to submit the proof.
  userAddress: string;

  // Description of disclosures made by the proof
  // This is provided by the front-end. The snap can not verify if the prover matches this description.
  // General description of the ZKP
  description: string;
  // Short description of each public input the proof is disclosing
  publicInputDescriptions: string[];

  // Whether the private input for the ZK proof generation requires to set the EdDSA private key (e.g. for fraud investigation)
  zkInputRequiresPrivKey: boolean;
};

type GenZKPErrorName = 'MissingInputParams';

export class GenZKPError extends GalacticaErrorBase<GenZKPErrorName> { }

/**
 * GenerateZKProof prepares and executes the call to generate a ZKP in the Galactica snap.
 * You can use it to generate various kinds of proofs, depending on the input you pass.
 * @param params - The parameters required to generate a ZKP in the Snap.
 * @param snapOrigin - Optional origin ID of the Snap if you want to use a non-default version.
 * @returns Request result with the ZK proof or error.
 * @throws RPCError on failure.
 */
export const generateZKProof = async (
  params: GenZkProofParams<ZkCertInputType>,
  snapOrigin: string = sdkConfig.defaultSnapOrigin,
) => {
  const response: ZkCertProof = await invokeSnap(
    {
      method: RpcMethods.GenZkCertProof,
      params,
    },
    snapOrigin,
  );

  return response;
};
