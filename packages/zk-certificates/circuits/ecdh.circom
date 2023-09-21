/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;
include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/escalarmulany.circom";

/**
 *   Generates an Elliptic-curve Diffie–Hellman shared key https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman
 *   It is symmetric and can be produced by both parties using their private key and the other party's public key.
 *   Implementation based on https://github.com/privacy-scaling-explorations/maci/blob/796c3fa49d4983478d306061f094cf8a7532d63a/circuits/circom/ecdh.circom#L5
 */
template Ecdh() {
    // Note: the private key needs to be hashed and pruned first (see lib/keyManagement/formatPrivKeyForBabyJub)
    signal input privKey;
    signal input pubKey[2];
    signal output sharedKey[2];

    component privBits = Num2Bits(253);
    privBits.in <== privKey;

    component mulFix = EscalarMulAny(253);
    mulFix.p[0] <== pubKey[0];
    mulFix.p[1] <== pubKey[1];

    for (var i = 0; i < 253; i++) {
        mulFix.e[i] <== privBits.out[i];
    }

    sharedKey[0] <== mulFix.out[0];
    sharedKey[1] <== mulFix.out[1];
}
