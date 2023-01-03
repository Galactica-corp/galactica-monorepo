import { buildEddsa } from 'circomlibjs';
import { createHolderCommitment } from 'zkkyc';

/**
 * @description Calculates the holder commitment from the eddsa key. It is used to link a ZkCert to a holder without revealing the holder's identity to the provider.
 * @param holderEddsaKey
 */
export async function calculateHolderCommitment(
  holderEddsaKey: string,
): Promise<string> {
  // use holder commitment function from zkkyc module (calculated on zkCert construction)
  return createHolderCommitment(await buildEddsa(), holderEddsaKey);
}
