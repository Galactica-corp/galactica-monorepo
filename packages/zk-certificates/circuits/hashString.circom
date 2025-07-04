/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";

/**
 * Hash a string using a Poseidon sponge hash of a message split into blocks of 31 bytes.
 * This circuit assumes that all inputs are uint8 values.
 * 
 * This circom circuit corresponds to the reference implementations in
 *   - https://github.com/iden3/go-iden3-crypto/blob/e5cf066b8be3da9a3df9544c65818df189fdbebe/poseidon/poseidon.go#L136
 *   - https://github.com/Galactica-corp/galactica-monorepo/blob/a6e1d37b99071d785d11efe256c3e0e1fab1f646/packages/zk-certificates/lib/poseidon.ts#L28
 * @param n - The number of uint8 inputs to the Poseidon hash function.
 */
template HashString(n){
    // The uint8 values to hash
    signal input inputs[n];
    // The resulting Poseidon hash
    signal output out;

    // This circuit assumes that all inputs are uint8 chars
    component lessThan[n];
    for (var i = 0; i < n; i++) {
        lessThan[i] = LessThan(252);
        lessThan[i].in[0] <== inputs[i];
        lessThan[i].in[1] <== 256;
        lessThan[i].out === 1;
    }

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

    component hashes[hashSteps];
    for (var i = 0; i < hashSteps; i++) {
        hashes[i] = Poseidon(frameSize);
    }

    var k = 0; // which position of a frame to fill next
    var h = 0; // which hash frame to fill next
    var dirty = 0; // whether there is some leftover input that did not fill a full frame

    for (var i = 0; i < n \ spongeChunkSize; i++) {
        dirty = 1;

        // fill next value in current frame
        // written this way to let the circom compiler sees that it expressable as quadratic constraint
        hashes[h].inputs[k] <== 0
            + inputs[i * spongeChunkSize + 00] * 0x1000000000000000000000000000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 01] * 0x10000000000000000000000000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 02] * 0x100000000000000000000000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 03] * 0x1000000000000000000000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 04] * 0x10000000000000000000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 05] * 0x100000000000000000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 06] * 0x1000000000000000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 07] * 0x10000000000000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 08] * 0x100000000000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 09] * 0x1000000000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 10] * 0x10000000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 11] * 0x100000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 12] * 0x1000000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 13] * 0x10000000000000000000000000000000000
            + inputs[i * spongeChunkSize + 14] * 0x100000000000000000000000000000000
            + inputs[i * spongeChunkSize + 15] * 0x1000000000000000000000000000000
            + inputs[i * spongeChunkSize + 16] * 0x10000000000000000000000000000
            + inputs[i * spongeChunkSize + 17] * 0x100000000000000000000000000
            + inputs[i * spongeChunkSize + 18] * 0x1000000000000000000000000
            + inputs[i * spongeChunkSize + 19] * 0x10000000000000000000000
            + inputs[i * spongeChunkSize + 20] * 0x100000000000000000000
            + inputs[i * spongeChunkSize + 21] * 0x1000000000000000000
            + inputs[i * spongeChunkSize + 22] * 0x10000000000000000
            + inputs[i * spongeChunkSize + 23] * 0x100000000000000
            + inputs[i * spongeChunkSize + 24] * 0x1000000000000
            + inputs[i * spongeChunkSize + 25] * 0x10000000000
            + inputs[i * spongeChunkSize + 26] * 0x100000000
            + inputs[i * spongeChunkSize + 27] * 0x1000000
            + inputs[i * spongeChunkSize + 28] * 0x10000
            + inputs[i * spongeChunkSize + 29] * 0x100
            + inputs[i * spongeChunkSize + 30] * 0x1;

        if (k == frameSize-1) {
            // frame is full, put hash into next frame
            hashes[h+1].inputs[0] <== hashes[h].out;
            k = 1;
            h++;
            dirty = 0;
        } else {
            k++;
        }
    }

    signal lastChunkBuild[n % spongeChunkSize];
    if (n % spongeChunkSize > 0) {
        // the last chunk of the message is less than 31 bytes
        // zero padding it, so that 0xdeadbeaf becomes
        // 0xdeadbeaf000000000000000000000000000000000000000000000000000000
        lastChunkBuild[0] <== inputs[(n \ spongeChunkSize) * spongeChunkSize];
        for (var i = 1; i < n % spongeChunkSize; i++) {
            lastChunkBuild[i] <== lastChunkBuild[i-1] * 0x100 + inputs[(n \ spongeChunkSize) * spongeChunkSize + i];
        }
        var paddingFactor = 1 << ((spongeChunkSize - n % spongeChunkSize) * 8);
        hashes[h].inputs[k] <== lastChunkBuild[n % spongeChunkSize - 1] * paddingFactor;
        k++;
    }

    if (dirty > 0) {
        // handle the last frame that might be only partially filled
        for (k=k; k < frameSize; k++) {
            hashes[h].inputs[k] <== 0;
        }
    }

    // some sanity checks
    h === hashSteps-1;

    out <== hashes[h].out;
}
