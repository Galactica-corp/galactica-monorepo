/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/escalarmulfix.circom";

/**
  * Circut for deriving the public key of a private key
  * Based on https://github.com/privacy-scaling-explorations/maci/blob/v1/circuits/circom/privToPubKey.circom
  */
template PrivToPubKey() {
  // Note: private key needs to be hashed, and then pruned before (see lib/keyManagement/formatPrivKeyForBabyJub)
  // supplying it to the circuit
  signal input privKey;
  signal output pubKey[2];

  component privBits = Num2Bits(253);
  privBits.in <== privKey;

  var BASE8[2] = [
    5299619240641551281634865583518297030282874472190772894086521144482721001553,
    16950150798460657717958625567821834550301663161624707787222815936182638968203
  ];

  component mulFix = EscalarMulFix(253, BASE8);
  for (var i = 0; i < 253; i++) {
    mulFix.e[i] <== privBits.out[i];
  }

  pubKey[0] <== mulFix.out[0];
  pubKey[1] <== mulFix.out[1];
}
