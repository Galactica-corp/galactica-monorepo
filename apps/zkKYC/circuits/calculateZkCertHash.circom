/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
Circuit to check that, given zkKYC infos we calculate the corresponding leaf hash
*/
template CalculateZkCertHash(){
    // zkKYC infos
    signal input contentHash;
    signal input providerAx;
    signal input providerAy;
    signal input providerS;
    signal input providerR8x;
    signal input providerR8y;
    signal input holderCommitment;
    signal input randomSalt;

    // zkCertHash as output
    signal output zkCertHash;

    // calculation using a Poseidon component
    component _zkCertHash = Poseidon(8);
    _zkCertHash.inputs[0] <== contentHash;
    _zkCertHash.inputs[1] <== providerAx;
    _zkCertHash.inputs[2] <== providerAy;
    _zkCertHash.inputs[3] <== providerS;
    _zkCertHash.inputs[4] <== providerR8x;
    _zkCertHash.inputs[5] <== providerR8y;
    _zkCertHash.inputs[6] <== holderCommitment;
    _zkCertHash.inputs[7] <== randomSalt;

    zkCertHash <== _zkCertHash.out;
}
