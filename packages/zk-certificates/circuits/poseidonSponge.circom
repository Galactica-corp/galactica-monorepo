/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Poseidon Hash with allowing more than 16 inputs by iteratively hashing 16 together with the previous result. Called sponge mode.
 * This circom circuit corresponds to the reference implementations in
 *   - https://github.com/iden3/go-iden3-crypto/blob/e5cf066b8be3da9a3df9544c65818df189fdbebe/poseidon/poseidon.go#L136
 *   - https://github.com/Galactica-corp/galactica-monorepo/blob/a6e1d37b99071d785d11efe256c3e0e1fab1f646/packages/zk-certificates/lib/poseidon.ts#L28
 * @param n - The number of inputs to the Poseidon hash function.
 */
template PoseidonSponge(n){
    signal input inputs[n];
    signal output out;

    // calculation using a Poseidon component
    component _zkCertHash = Poseidon(2);
    _zkCertHash.inputs[0] <== inputs[0];
    _zkCertHash.inputs[1] <== inputs[1];

    out <== _zkCertHash.out;
}
