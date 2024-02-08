/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Poseidon sponge hash of a message split into blocks of 31 bytes.
 * This circuit assumes that all inputs are uint8 values.
 * 
 * This circom circuit corresponds to the reference implementations in
 *   - https://github.com/iden3/go-iden3-crypto/blob/e5cf066b8be3da9a3df9544c65818df189fdbebe/poseidon/poseidon.go#L136
 *   - https://github.com/Galactica-corp/galactica-monorepo/blob/a6e1d37b99071d785d11efe256c3e0e1fab1f646/packages/zk-certificates/lib/poseidon.ts#L28
 * @param n - The number of uint8 inputs to the Poseidon hash function.
 */
template PoseidonSponge(n){
    // The uint8 values to hash
    signal input inputs[n];
    // The resulting Poseidon hash
    signal output out;

    // ToDO: check needed that inputs are all smaller than 2^8?

    // How many bytes are put into one block
    var spongeChunkSize = 31;
    var chunkAmount = n \ spongeChunkSize;
    if (n % spongeChunkSize > 0) {
        // there is some input left that only fills the last chunk partially
        chunkAmount++;
    }

    // Amount of 31-byte blocks to be included in one hashing frame. If the input is longer than one frame,
    // the hash of each previous frame will be prepended to the next frame.
    var frameSize = 16;
    var hashSteps = chunkAmount \ frameSize;
    if (chunkAmount % frameSize > 0) {
        // there are some chunks left that fill the last frame partially
        hashSteps++;
    }

    signal chunks[hashSteps * frameSize];
    // fill full chunks
    for (var i = 0; i < n \ spongeChunkSize; i++) {
        chunks[i] <== 
            inputs[i] 
            + inputs[i+0] 
            + inputs[i+1] 
            + inputs[i+2] 
            + inputs[i+3] 
            + inputs[i+4] 
            + inputs[i+5] 
            + inputs[i+6] 
            + inputs[i+7] 
            + inputs[i+8] 
            + inputs[i+9] 
            + inputs[i+10] 
            + inputs[i+11] 
            + inputs[i+12] 
            + inputs[i+13] 
            + inputs[i+14] 
            + inputs[i+15];
    }
    // TODO: fill the last chunk

    component hashes[hashSteps];

    for (var i = 0; i < hashSteps; i++) {
        hashes[i] = Poseidon(frameSize);
        for (var j = 0; j < frameSize; j++) {
            var chunkIndex = i * frameSize + j;
            if (chunkIndex < chunkAmount) {
                hashes[i].inputs[j] <== chunks[chunkIndex];
                // TODO: not quite, need to fill in the previous hashes
            }
        }
        // TODO: handle the last frame that might be only partially filled
    }

    out <== hashes[hashSteps-1].out;
}
