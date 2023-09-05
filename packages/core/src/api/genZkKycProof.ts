import { z } from 'zod';

import { ZkCertProof, zkCertStandards } from '../common';
import { GalacticaBaseError, GalacticaBaseResponse } from './base';

// Schema
const inputSchema = z.object({
  currentTime: z.union([z.string().datetime(), z.number()]),
  dAppAddress: z
    .string({ required_error: 'dAppAddress missing in input.' })
    .startsWith('0x', 'Wrong userAddress.')
    .length(42, 'Wrong userAddress.'),
});

const zkeyHeaderSchema = z.object({
  protocol: z.enum(['groth16']),
  n8q: z.number(),
  q: z.string(),
  n8r: z.number(),
  r: z.string(),
  nVars: z.number(),
  nPublic: z.number(),
  domainSize: z.number(),
  power: z.number(),
  vk_alpha_1: z.string(),
  vk_beta_1: z.string(),
  vk_beta_2: z.string(),
  vk_gamma_2: z.string(),
  vk_delta_1: z.string(),
  vk_delta_2: z.string(),
  curveName: z.enum(['bn128']),
});

const proverSchema = z.object(
  {
    wasm: z.string(),
    zkeyHeader: zkeyHeaderSchema,
    zkeySections: z.array(z.string()),
  },
  { invalid_type_error: 'Wrong prover data.' },
);

export const reqParamsSchema = z.object({
  input: inputSchema,
  requirements: z.object({
    zkCertStandard: z.enum(zkCertStandards),
  }),
  prover: proverSchema,

  // TODO: should we use ethers.utils.isAddress to check checksum?
  userAddress: z
    .string({ required_error: 'userAddress missing in request parameters.' })
    .startsWith('0x', 'Wrong userAddress.')
    .length(42, 'Wrong userAddress.'),

  disclosureDescription: z.string().optional(),
});

// Req Params
export type GenZkKycProofParams = z.infer<typeof reqParamsSchema>;

// Response
export type GenZkKycProofResponse = GalacticaBaseResponse<ZkCertProof>;

// Errors
type GenZkKycProofErrorName =
  | 'RejectedConfirm'
  | 'MissingInputParams'
  | 'MissingHolder';

export class GenZkKycProofError extends GalacticaBaseError<GenZkKycProofErrorName> {}
