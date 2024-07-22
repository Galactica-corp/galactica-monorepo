/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../merkleProof.circom";

/**
 * Experimental circuit to combine reputation data from multiple accounts into a single reputation score.
 *
 * @param levels - number of levels of the merkle tree.
 */
template CrossAccountReputation(levels){
    // variables related to the merkle proof
    signal input pathElements[levels];
    signal input leafIndex;
    signal input root;
    signal input leafHash;

    // use the merkle proof component to calculate the root
    component merkleProof = MerkleProof(levels);
    merkleProof.leaf <== leafHash;
    for (var i = 0; i < levels; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
    }
    merkleProof.leafIndex <== leafIndex;

    // check that the calculated root is equal to the public root
    root === merkleProof.root;
    //
}

component main {public [
  root
]} = CrossAccountReputation(32);
