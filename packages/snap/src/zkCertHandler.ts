import { buildEddsa, buildPoseidon } from "circomlibjs";
import { ZKCertificate } from "zkkyc";


export async function calculateHolderCommitment(holderEddsaKey: string): Promise<string> {
    // use holder commitment function from zkkyc module (calculated on zkCert construction)
    const zkCert = new ZKCertificate(holderEddsaKey, await buildPoseidon(), await buildEddsa());
    return zkCert.holderCommitment;
}
