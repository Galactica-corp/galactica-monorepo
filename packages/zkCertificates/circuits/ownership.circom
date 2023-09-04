/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

/*
  Circuit verifying the ownership of a zkCertificate with a signature in the holder commitment.

  For efficient computation in zkSNARKs, it uses the EdDSA signature scheme
  (https://iden3-docs.readthedocs.io/en/latest/iden3_repos/research/publications/zkproof-standards-workshop-2/ed-dsa/ed-dsa.html)
  with the Poseidon hash function (https://www.poseidon-hash.info/).
*/
template Ownership(){
    // holderCommitment = poseidon(eddsa(poseidon(pubkey)))  // fixing the owner address while hiding it from the provider
    signal input holderCommitment;
    // TODO: sign receiver address to prevent replay attacks

    // poseidon hash of the message to be signed
    // public key of the signer
    signal input ax;
    signal input ay;
    // EdDSA signature
    signal input s;
    signal input r8x;
    signal input r8y;

    signal output valid;

    // circuit has no output, because adding constraints is enough to verify the signature

    // the message to be signed is the hashed pubkey in the holder commitment
    component hashPubkey = Poseidon(2);
    hashPubkey.inputs[0] <== ax;
    hashPubkey.inputs[1] <== ay;

    // transforming hash into field element accepted by eddsa (smaller so take modulo)
    signal hashPubkeyMod <-- hashPubkey.out % 2736030358979909402780800718157159386076813972158567259200215660948447373040;

    // using the standard EdDSA circuit from circomlib to verify the signature
    component eddsa = EdDSAPoseidonVerifier();
    eddsa.enabled <== 1;
    eddsa.M <== hashPubkeyMod;
    eddsa.Ax <== ax;
    eddsa.Ay <== ay;
    eddsa.S <== s;
    eddsa.R8x <== r8x;
    eddsa.R8y <== r8y;

    // check that the holder commitment matches the signature
    component hashSig = Poseidon(3);
    hashSig.inputs[0] <== s;
    hashSig.inputs[1] <== r8x;
    hashSig.inputs[2] <== r8y;

    component commitmentMatching = IsEqual();
    commitmentMatching.in[0] <== hashSig.out;
    commitmentMatching.in[1] <== holderCommitment;
    commitmentMatching.out === 1;
    valid <== commitmentMatching.out;
}
