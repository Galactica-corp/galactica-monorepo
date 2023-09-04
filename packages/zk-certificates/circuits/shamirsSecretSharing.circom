/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "polynomial.circom";

/*
    Circuit to generate Shamir's Secret Sharing shares.
    It takes a scecret and splits it into n fragments, of which k are needed to reconstruct the secret.

    https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing

    Parameters:
    n: number of shares to generate
    k: number of shares needed to reconstruct the secret
*/
template ShamirsSecretSharing(n, k) {
    // the secret to be shared
    signal input secret;
    // random salt to generate the coefficients of the polynomial, it should be different for each new generation
    signal input salt;

    signal output shares[n];

    // check k <= n, otherwise the secret can not be recovered
    component parameterValidity = LessEqThan(128);
    parameterValidity.in[0] <== k;
    parameterValidity.in[1] <== n;
    parameterValidity.out === 1;

    // Generate the coefficients for the polynomial from the random salt
    component coefGen[k-1];
    for (var i = 0; i < k-1; i++) {
        coefGen[i] = Poseidon(3);
        coefGen[i].inputs[0] <== salt;
        coefGen[i].inputs[1] <== i;
        coefGen[i].inputs[2] <== secret;
    }
    
    // Generate the shares = points from the polynomial
    component polynomial = Polynomial(k, n);
    // input secret as the first coefficient and the rest from the coefGen
    // meaning that poly(0) = secret
    polynomial.coef[0] <== secret;
    for (var j = 1; j < k; j++) {
        polynomial.coef[j] <== coefGen[j-1].out;
    }
    // calculate shares for each institution, which is identified by it's index
    for (var i = 0; i < n; i++) {
        // input x = i+1 (ensuring that no share is f(0)=secret )
        polynomial.x[i] <== i+1;
    }
    // second loop to pass outputs because outputs are only available after all inputs are set
    for (var i = 0; i < n; i++) {
        shares[i] <== polynomial.y[i];
    }
}
