import { z } from 'zod';

export const merkleProofSchema = z.object({
  leaf: z.string(),
  // hashes of the branches on the side of the path
  pathElements: z.array(z.string()),
  // interpreted as binary number. If a bit is set, it means that the path is the right part of the parent node.
  pathIndices: z.number(),
  root: z.string(),
});

/**
 * Simple struct for a merkle proof
 */
export type MerkleProof = z.infer<typeof merkleProofSchema>;
