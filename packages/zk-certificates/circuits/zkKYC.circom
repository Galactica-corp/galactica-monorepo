/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";
include "./merkleProof.circom";
include "./calculateZkCertHash.circom";
include "./authorization.circom";
include "./ownership.circom";
include "./encryptionProof.circom";
include "./humanID.circom";
include "./providerSignatureCheck.circom";
include "./shamirsSecretSharing.circom";

/**
 * Circuit to check that, given zkKYC infos we calculate the corresponding leaf hash
 *
 * @param levels - number of levels of the merkle tree.
 * @param maxExpirationLengthDays - maximum number of days that a verificationSBT can be valid for
 * @param shamirK - number of shares needed from investigation authorities to reconstruct the zkKYC DID
 * @param shamirN - number of investigation authorities to generate shares for. (Use 0 to disable fraud investigations)
 */
template ZKKYC(levels, maxExpirationLengthDays, shamirK, shamirN){
    signal input holderCommitment;
    signal input randomSalt;

    // zkKYC data fields
    signal input surname;
    signal input forename;
    signal input middlename;
    signal input yearOfBirth;
    signal input monthOfBirth;
    signal input dayOfBirth;
    signal input verificationLevel;
    signal input expirationDate;
    signal input streetAndNumber;
    signal input postcode;
    signal input town;
    signal input region;
    signal input country;
    signal input citizenship;
    signal input passportID;

    // provider's EdDSA signature of the leaf hash
    signal input providerS;
    signal input providerR8x;
    signal input providerR8y;

    // variables related to the merkle proof
    signal input pathElements[levels];
    signal input pathIndices;
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

    //inputs for encryption of fraud investigation data (rest is below because of variable length)
    signal input userPrivKey;

    //humanID related variable
    //humanID as public input, so dApp can use it
    signal input humanID;

    //dAppAddress is public so it can be checked by the dApp
    signal input dAppAddress;

    // pub key of the provider
    signal input providerAx;
    signal input providerAy;

    signal output userPubKey[2]; // becomes public as part of the output to check that it corresponds to user address
    signal output valid;
    signal output verificationExpiration; 

    // variable length part of public input at the end to simplify indexing in the smart contract
    signal input investigationInstitutionPubKey[shamirN][2]; // should be public so we can check that it is the same as the current fraud investigation institution public key
    signal output encryptedData[shamirN][2]; // becomes public as part of the output to be stored in the verification SBT


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

    // content hash for zkKYC data
    component contentHash = Poseidon(15);
    contentHash.inputs[0] <== surname;
    contentHash.inputs[1] <== forename;
    contentHash.inputs[2] <== middlename;
    contentHash.inputs[3] <== yearOfBirth;
    contentHash.inputs[4] <== monthOfBirth;
    contentHash.inputs[5] <== dayOfBirth;
    contentHash.inputs[6] <== verificationLevel;
    contentHash.inputs[7] <== expirationDate;
    contentHash.inputs[8] <== streetAndNumber;
    contentHash.inputs[9] <== postcode;
    contentHash.inputs[10] <== town;
    contentHash.inputs[11] <== region;
    contentHash.inputs[12] <== country;
    contentHash.inputs[13] <== citizenship;
    contentHash.inputs[14] <== passportID;

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

    // use the merkle proof component to calculate the root
    component merkleProof = MerkleProof(levels);
    merkleProof.leaf <== zkCertHash.zkCertHash;
    for (var i = 0; i < levels; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
    }
    merkleProof.pathIndices <== pathIndices;

    // check that the calculated root is equal to the public root
    root === merkleProof.root;

    component shamir;
    component derivedShamirSalt;
    component encryptionProof[shamirN];
    if (shamirN > 0){
        // serive pseudorandom salt from input. Using the following fields to make sure that 
        //  it is not guessable by KYC guardians or institutions completing other fraud investigations
        derivedShamirSalt = Poseidon(3);
        derivedShamirSalt.inputs[0] <== currentTime;
        derivedShamirSalt.inputs[1] <== userPrivKey;
        derivedShamirSalt.inputs[2] <== zkCertHash.zkCertHash;
        
        // distribute secret into multiple shares, one for each institution
        // the encryption step requires two inputs, one will be the shamir share
        // if there are more than two secret fields to disclose to authorities using shamir's secret sharing,
        // it would make sense to share the decryption key instead
        shamir = ShamirsSecretSharing(shamirN, shamirK);
        shamir.secret <== zkCertHash.zkCertHash;
        shamir.salt <== derivedShamirSalt.out;

        // encrypt shamir shares for each of the receiving institutions
        for (var i = 0; i < shamirN; i++) {
            encryptionProof[i] = encryptionProof();
            encryptionProof[i].senderPrivKey <== userPrivKey;
            encryptionProof[i].receiverPubKey[0] <== investigationInstitutionPubKey[i][0];
            encryptionProof[i].receiverPubKey[1] <== investigationInstitutionPubKey[i][1];
            encryptionProof[i].msg[0] <== shamir.shares[i];
            encryptionProof[i].msg[1] <== providerAx;  // this is actually not needed because the KYC guardian is already a public input

            encryptedData[i][0] <== encryptionProof[i].encryptedMsg[0];
            encryptedData[i][1] <== encryptionProof[i].encryptedMsg[1];
        }   
        // The user pubkey should be the same each time
        userPubKey[0] <== encryptionProof[0].senderPubKey[0];
        userPubKey[1] <== encryptionProof[0].senderPubKey[1];
    }

    component calculateHumanId = HumanID();
    calculateHumanId.surname <== surname;
    calculateHumanId.forename <== forename;
    calculateHumanId.middlename <== middlename;
    calculateHumanId.yearOfBirth <== yearOfBirth;
    calculateHumanId.monthOfBirth <== monthOfBirth;
    calculateHumanId.dayOfBirth <== dayOfBirth;
    calculateHumanId.passportID <== passportID;
    calculateHumanId.dAppAddress <== dAppAddress;
    
    calculateHumanId.humanID === humanID;

    // check that the time has not expired
    component timeHasntPassed = GreaterThan(128);
    timeHasntPassed.in[0] <== expirationDate;
    timeHasntPassed.in[1] <== currentTime;

    // the expiration date of the resulting Verification SBT should not equal the expiration date
    // of the zkKYC data to leak less information that could make it possible to trace the user
    // So we take a date a fixed time in the future, but latest at the zkKYC expiration
    var verificationExpirationMax = currentTime + maxExpirationLengthDays * 24 * 60 * 60;
    verificationExpiration <-- expirationDate < verificationExpirationMax ? expirationDate : verificationExpirationMax;
    component verificationExpirationMaxCheck = LessEqThan(32); // 32 bits are enough for unix timestamps until year 2106
    verificationExpirationMaxCheck.in[0] <== verificationExpiration;
    verificationExpirationMaxCheck.in[1] <== verificationExpiration;
    verificationExpirationMaxCheck.out === 1;

    valid <== timeHasntPassed.out;
}
