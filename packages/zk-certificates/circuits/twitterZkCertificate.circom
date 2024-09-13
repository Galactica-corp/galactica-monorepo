/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";
include "./merkleProof.circom";
include "./calculateZkCertHash.circom";
include "./authorization.circom";
include "./ownership.circom";
include "./providerSignatureCheck.circom";

/**
 * Circuit to check that, given twitter accounts infos we calculate the corresponding leaf hash
 *
 * @param levels - number of levels of the merkle tree.
 * @param maxExpirationLengthDays - maximum number of days that a verificationSBT can be valid for
 */
template TwitterZkCertificate(levels, maxExpirationLengthDays){
    signal input holderCommitment;
    signal input randomSalt;

    // twitter zkCertificate data fields
    signal input id;
    signal input createdAt;
    signal input followersCount;
    signal input followingCount;
    signal input listedCount;
    signal input tweetCount;
    signal input username;
    signal input verified;

    signal input expirationDate;

    // provider's EdDSA signature of the leaf hash
    signal input providerS;
    signal input providerR8x;
    signal input providerR8y;

    // variables related to the merkle proof
    signal input pathElements[levels];
    signal input leafIndex;
    signal input root;

    signal input currentTime;

    // verify that proof creator indeed owns the pubkey behind the holdercommitment
    // public key of the signer
    signal input ax;
    signal input ay;
    // EdDSA signature of the pubkey
    signal input s;
    signal input r8x;
    signal input r8y;

    // verify that tx sender is authorized to use the proof
    // user address as message to be signed, this will be a public input so the SC can compare it with the onchain message sender
    signal input userAddress;
    // EdDSA signature of the user address
    signal input s2;
    signal input r8x2;
    signal input r8y2;

    // pub key of the provider
    signal input providerAx;
    signal input providerAy;

    signal output valid;
    signal output verificationExpiration;

    // we don't need to check the output 'valid' of the ownership circuit because it is always 1
    component ownership = Ownership();
    ownership.holderCommitment <== holderCommitment;
    ownership.ax <== ax;
    ownership.ay <== ay;
    ownership.s <== s;
    ownership.r8x <== r8x;
    ownership.r8y <== r8y;

    ownership.valid === 1;

    component authorization = Authorization();
    authorization.userAddress <== userAddress;
    authorization.ax <== ax;
    authorization.ay <== ay;
    authorization.s <== s2;
    authorization.r8x <== r8x2;
    authorization.r8y <== r8y2;

    // content hash for twitter ZkCertificate data
    component contentHash = Poseidon(8);
    contentHash.inputs[0] <== createdAt;
    contentHash.inputs[1] <== id;
    contentHash.inputs[2] <== followersCount;
    contentHash.inputs[3] <== followingCount;
    contentHash.inputs[4] <== listedCount;
    contentHash.inputs[5] <== tweetCount;
    contentHash.inputs[6] <== username;
    contentHash.inputs[7] <== verified;

    // provider signature verification
    component providerSignatureCheck = ProviderSignatureCheck();
    providerSignatureCheck.contentHash <== contentHash.out;
    providerSignatureCheck.holderCommitment <== holderCommitment;
    providerSignatureCheck.providerAx <== providerAx;
    providerSignatureCheck.providerAy <== providerAy;
    providerSignatureCheck.providerS <== providerS;
    providerSignatureCheck.providerR8x <== providerR8x;
    providerSignatureCheck.providerR8y <== providerR8y;

    // calculation using a Poseidon component
    component zkCertHash = CalculateZkCertHash();
    zkCertHash.contentHash <== contentHash.out;
    zkCertHash.providerAx <== providerAx;
    zkCertHash.providerAy <== providerAy;
    zkCertHash.providerS <== providerS;
    zkCertHash.providerR8x <== providerR8x;
    zkCertHash.providerR8y <== providerR8y;
    zkCertHash.holderCommitment <== holderCommitment;
    zkCertHash.randomSalt <== randomSalt;
    zkCertHash.expirationDate <== expirationDate;

    // use the merkle proof component to calculate the root
    component merkleProof = MerkleProof(levels);
    merkleProof.leaf <== zkCertHash.zkCertHash;
    for (var i = 0; i < levels; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
    }

    merkleProof.leafIndex <== leafIndex;

    // check that the calculated root is equal to the public root
    root === merkleProof.root;

    // check that the time has not expired
    component timeHasntPassed = GreaterThan(128);
    timeHasntPassed.in[0] <== expirationDate;
    timeHasntPassed.in[1] <== currentTime;

    // the expiration date of the resulting Verification SBT should not equal the expiration date
    // of the twitter zkCertificate data to leak less information that could make it possible to trace the user
    // So we take a date a fixed time in the future, but latest at the twitter zkCertificate expiration
    var verificationExpirationMax = currentTime + maxExpirationLengthDays * 24 * 60 * 60;
    verificationExpiration <-- expirationDate < verificationExpirationMax ? expirationDate : verificationExpirationMax;
    component verificationExpirationMaxCheck = LessEqThan(32); // 32 bits are enough for unix timestamps until year 2106
    verificationExpirationMaxCheck.in[0] <== verificationExpiration;
    verificationExpirationMaxCheck.in[1] <== verificationExpiration;
    verificationExpirationMaxCheck.out === 1;

    valid <== timeHasntPassed.out;
}
