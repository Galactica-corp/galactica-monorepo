import { buildEddsa } from "circomlibjs";
import { createHolderCommitment } from "zkkyc";


export async function calculateHolderCommitment(holderEddsaKey: string): Promise<string> {
    // use holder commitment function from zkkyc module (calculated on zkCert construction)
    return createHolderCommitment(await buildEddsa(), holderEddsaKey);
}
