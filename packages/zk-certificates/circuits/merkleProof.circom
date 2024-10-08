/*
Forked from tornado cash nova
Main difference to merkle trees on Ethereum is that they use the poseidon hash, which is more zk friendly.
*/

pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/switcher.circom";

// Verifies that merkle proof is correct for given merkle root and a leaf
// leafIndex can also be used as pathIndices, containing bits is an array of 0/1 selectors telling whether given pathElement is on the left or right side of merkle path
template MerkleProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input leafIndex;
    signal output root;

    component switcher[levels];
    component hasher[levels];

    component indexBits = Num2Bits(levels);
    indexBits.in <== leafIndex;

    for (var i = 0; i < levels; i++) {
        switcher[i] = Switcher();
        switcher[i].L <== i == 0 ? leaf : hasher[i - 1].out;
        switcher[i].R <== pathElements[i];
        switcher[i].sel <== indexBits.out[i];

        hasher[i] = Poseidon(2);
        hasher[i].inputs[0] <== switcher[i].outL;
        hasher[i].inputs[1] <== switcher[i].outR;
    }

    root <== hasher[levels - 1].out;
}