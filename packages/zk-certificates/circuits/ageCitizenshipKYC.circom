/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/gates.circom";
include "./ageProof.circom";
include "./setOperations.circom";
include "./zkKYC.circom";

/**
 * Circuit to check that,
 *  1. User holds a valid zkKYC
 *  2. Age is above a threshold
 *  3. User is not a citizen of a country from the exclusion list
 *  (optional) 4. Shamir fraud investigation setup
 *
 * @param levels - Number of levels of the merkle tree.
 * @param maxExpirationLengthDays - Maximum number of days that a verificationSBT can be valid for.
 * @param shamirK - Number of shares needed from investigation authorities to reconstruct the zkKYC DID.
 * @param shamirN - Number of investigation authorities to generate shares for. (Use 0 to disable fraud investigations).
 * @param countryExclusionListSize - Size of the country sanction list.
 */
template AgeCitizenshipKYC(levels, maxExpirationLengthDays, shamirK, shamirN, countryExclusionListSize){
    signal input holderCommitment;
    signal input randomSalt;
    signal input expirationDate;

    // zkKYC data fields
    signal input surname;
    signal input forename;
    signal input middlename;
    signal input yearOfBirth;
    signal input monthOfBirth;
    signal input dayOfBirth;
    signal input verificationLevel;
    signal input streetAndNumber;
    signal input postcode;
    signal input town;
    signal input region;
    signal input country;
    signal input citizenship;

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

    // public variables related to age proof circuit
    signal input currentYear;
    signal input currentMonth;
    signal input currentDay;
    // age threshold
    signal input ageThreshold;

    // country sanction list (should be made public so it can be checked by the dApp)
    signal input countryExclusionList[countryExclusionListSize];

    //inputs for encryption of fraud investigation data (rest is below because of variable length)
    signal input userPrivKey;

    // humanID for uniquly  counting and identifying persons
    signal output humanID;

    //dAppAddress is public so it can be checked by the dApp
    signal input dAppAddress;

    // pub key of the provider
    signal input providerAx;
    signal input providerAy;

    // provider's EdDSA signature of the leaf hash
    signal input providerS;
    signal input providerR8x;
    signal input providerR8y;

    // final result
    signal output userPubKey[2]; // required in case of fraud investigation to generate symmetric EDDSA key for decryption
    signal output valid;
    signal output error; // bit encoded for the various causes of valid=false
    signal output verificationExpiration; 

    // variable length part of public input at the end to simplify indexing in the smart contract
    signal input investigationInstitutionPubKey[shamirN][2]; // should be public so we can check that it is the same as the current fraud investigation institution public key
    signal output encryptedData[shamirN][2]; // becomes public as part of the output to be stored in the verification SBT

    component zkKYC = ZKKYC(levels, maxExpirationLengthDays, shamirK, shamirN);
    zkKYC.holderCommitment <== holderCommitment;
    zkKYC.randomSalt <== randomSalt;
    zkKYC.expirationDate <== expirationDate;
    zkKYC.surname <== surname;
    zkKYC.forename <== forename;
    zkKYC.middlename <== middlename;
    zkKYC.yearOfBirth <== yearOfBirth;
    zkKYC.monthOfBirth <== monthOfBirth;
    zkKYC.dayOfBirth <== dayOfBirth;
    zkKYC.verificationLevel <== verificationLevel;
    zkKYC.streetAndNumber <== streetAndNumber;
    zkKYC.postcode <== postcode;
    zkKYC.town <== town;
    zkKYC.region <== region;
    zkKYC.country <== country;
    zkKYC.citizenship <== citizenship;
    zkKYC.userPrivKey <== userPrivKey;
    for (var i = 0; i < shamirN; i++) {
        zkKYC.investigationInstitutionPubKey[i][0] <== investigationInstitutionPubKey[i][0];
        zkKYC.investigationInstitutionPubKey[i][1] <== investigationInstitutionPubKey[i][1];
    }
    zkKYC.providerAx <== providerAx;
    zkKYC.providerAy <== providerAy;
    zkKYC.providerS <== providerS;
    zkKYC.providerR8x <== providerR8x;
    zkKYC.providerR8y <== providerR8y;
    for (var i = 0; i < levels; i++) {
        zkKYC.pathElements[i] <== pathElements[i];
    }
    zkKYC.leafIndex <== leafIndex;
    zkKYC.root <== root;
    zkKYC.currentTime <== currentTime;
    zkKYC.ax <== ax;
    zkKYC.ay <== ay;
    zkKYC.s <== s;
    zkKYC.r8x <== r8x;
    zkKYC.r8y <== r8y;
    zkKYC.userAddress <== userAddress;
    zkKYC.s2 <== s2;
    zkKYC.r8x2 <== r8x2;
    zkKYC.r8y2 <== r8y2;
    zkKYC.dAppAddress <== dAppAddress;
    userPubKey[0] <== zkKYC.userPubKey[0];
    userPubKey[1] <== zkKYC.userPubKey[1];
    for (var i = 0; i < shamirN; i++) {
        encryptedData[i][0] <== zkKYC.encryptedData[i][0];
        encryptedData[i][1] <== zkKYC.encryptedData[i][1];
    }
    verificationExpiration <== zkKYC.verificationExpiration;
    humanID <== zkKYC.humanID;

    component ageProof = AgeProof();
    ageProof.yearOfBirth <== yearOfBirth;
    ageProof.monthOfBirth <== monthOfBirth;
    ageProof.dayOfBirth <== dayOfBirth;
    ageProof.currentYear <== currentYear;
    ageProof.currentMonth <== currentMonth;
    ageProof.currentDay <== currentDay;
    ageProof.ageThreshold <== ageThreshold;

    component countrySanctionCheck = Exclusion(countryExclusionListSize);
    countrySanctionCheck.value <== citizenship;
    for (var i = 0; i < countryExclusionListSize; i++){
        countrySanctionCheck.list[i] <== countryExclusionList[i];
    }

    component and = MultiAND(3);
    and.in[0] <== zkKYC.valid;
    and.in[1] <== ageProof.valid;
    and.in[2] <== countrySanctionCheck.valid;

    valid <== and.out;

    error <== 0 
        + 1 * (1 - zkKYC.valid) 
        + 2 * (1 - ageProof.valid) 
        + 4 * (1 - countrySanctionCheck.valid);
}
