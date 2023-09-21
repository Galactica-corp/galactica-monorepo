/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../../../node_modules/circomlib/circuits/poseidon.circom";

/*
  Circuit verifying that provider signature is correctly submitted

*/
template ProviderSignatureCheck(){

    signal input contentHash;
    signal input holderCommitment;

    signal input providerAx;
    signal input providerAy;
    signal input providerS;
    signal input providerR8x;
    signal input providerR8y;


    // circuit has no output, because adding constraints is enough to verify the signature

    // provider signature verification
    component messageSignedByProvider = Poseidon(2);
    messageSignedByProvider.inputs[0] <== contentHash;
    messageSignedByProvider.inputs[1] <== holderCommitment;

    // transforming hash into field element accepted by eddsa (smaller so take modulo)
    signal messageSignedByProviderMod <-- messageSignedByProvider.out % 2736030358979909402780800718157159386076813972158567259200215660948447373040;

    // using the standard EdDSA circuit from circomlib to verify the signature
    component eddsa = EdDSAPoseidonVerifier();
    eddsa.enabled <== 1;
    eddsa.M <== messageSignedByProviderMod;
    eddsa.Ax <== providerAx;
    eddsa.Ay <== providerAy;
    eddsa.S <== providerS;
    eddsa.R8x <== providerR8x;
    eddsa.R8y <== providerR8y;

}
