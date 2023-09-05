import { z } from 'zod';

import { merkleProofSchema } from '../common/merkleProof';
import { GalacticaBaseError, GalacticaBaseResponse } from './base';

// Req Params
export const updateMerkleProofParamsSchema = z.object({
  proofs: z.array(merkleProofSchema),
});

export type UpdateMerkleProofParams = z.infer<
  typeof updateMerkleProofParamsSchema
>;

// Response

export type UpdateMerkleProofResponse = GalacticaBaseResponse<boolean>;

// Error
type ErrorName = 'RejectedConfirm' | 'NotFound';
export class UpdateMerkleProofError extends GalacticaBaseError<ErrorName> {}
