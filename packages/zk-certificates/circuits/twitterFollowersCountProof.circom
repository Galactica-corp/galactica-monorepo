/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.2.2;

include "../../../node_modules/circomlib/circuits/gates.circom";
include "./twitterZkCertificate.circom";

/**
 * Circuit to check that a given twitter zkCertificate has at least a certain number of followers
 *
 * @param levels - number of levels of the merkle tree.
 * @param maxExpirationLengthDays - maximum number of days that a verificationSBT can be valid for
 */
template TwitterFollowersCountProof(levels, maxExpirationLengthDays){
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


    signal input followersCountThreshold;

    signal output valid;
    signal output verificationExpiration;


    component twitterZkCertificate = TwitterZkCertificate(levels, maxExpirationLengthDays);
    twitterZkCertificate.holderCommitment <== holderCommitment;
    twitterZkCertificate.randomSalt <== randomSalt;

    // twitter zkCertificate data fields
    twitterZkCertificate.id <== id;
    twitterZkCertificate.createdAt <== createdAt;
    twitterZkCertificate.followersCount <== followersCount;
    twitterZkCertificate.followingCount <== followingCount;
    twitterZkCertificate.listedCount <== listedCount;
    twitterZkCertificate.tweetCount <== tweetCount;
    twitterZkCertificate.username <== username;
    twitterZkCertificate.verified <== verified;

    twitterZkCertificate.expirationDate <== expirationDate;

    // provider's EdDSA signature of the leaf hash
    twitterZkCertificate.providerS <== providerS;
    twitterZkCertificate.providerR8x <== providerR8x;
    twitterZkCertificate.providerR8y <== providerR8y;

    // variables related to the merkle proof
    for (var i = 0; i < levels; i++) {
        twitterZkCertificate.pathElements[i] <== pathElements[i];
    }
    twitterZkCertificate.leafIndex <== leafIndex;
    twitterZkCertificate.root <== root;
    twitterZkCertificate.currentTime <== currentTime;

    // verify that proof creator indeed owns the pubkey behind the holdercommitment
    // public key of the signer
    twitterZkCertificate.ax <== ax;
    twitterZkCertificate.ay <== ay;
    // EdDSA signature of the pubkey
    twitterZkCertificate.s <== s;
    twitterZkCertificate.r8x <== r8x;
    twitterZkCertificate.r8y <== r8y;

    // verify that tx sender is authorized to use the proof
    // user address as message to be signed, this will be a public input so the SC can compare it with the onchain message sender
    twitterZkCertificate.userAddress <== userAddress;
    // EdDSA signature of the user address
    twitterZkCertificate.s2 <== s2;
    twitterZkCertificate.r8x2 <== r8x2;
    twitterZkCertificate.r8y2 <== r8y2;

    // pub key of the provider
    twitterZkCertificate.providerAx <== providerAx;
    twitterZkCertificate.providerAy <== providerAy;


    verificationExpiration <== twitterZkCertificate.verificationExpiration;

    // circuit to check the followersCount
    component compare = GreaterEqThan(128);
    compare.in[0] <== followersCount;
    compare.in[1] <== followersCountThreshold;

    component and = AND();
    and.a <== twitterZkCertificate.valid;
    and.b <== compare.out;

    valid <== and.out;
}
