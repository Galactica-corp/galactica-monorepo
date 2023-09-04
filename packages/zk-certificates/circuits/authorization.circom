/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../../../node_modules/circomlib/circuits/poseidon.circom";

/*
  Circuit verifying that the onchain message sender is authorized to use the zkKYC record.
  He proves this fact by providing his address signed by the account hidden behind the holder commitment of the zkKYC rcord.

*/
template Authorization(){

    // message to be signed, this will be a public input so the SC can compare it with the onchain message sender
    signal input userAddress;
    // pubkey of the account behind holder commitment
    signal input ax;
    signal input ay;
    // EdDSA signature
    signal input s;
    signal input r8x;
    signal input r8y;


    // circuit has no output, because adding constraints is enough to verify the signature

    // using the standard EdDSA circuit from circomlib to verify the signature
    component eddsa = EdDSAPoseidonVerifier();
    eddsa.enabled <== 1;
    eddsa.M <== userAddress;
    eddsa.Ax <== ax;
    eddsa.Ay <== ay;
    eddsa.S <== s;
    eddsa.R8x <== r8x;
    eddsa.R8y <== r8y;

}
