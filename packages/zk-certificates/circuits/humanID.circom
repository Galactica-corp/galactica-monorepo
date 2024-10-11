/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/poseidon.circom";

/*
  Circuit calculating the dApp specific human ID. 
  It can be used by applications that want to limit the amount of interactions per human, e.g., for voting or IDO allocation.

  Calculated by hashing KYC fields uniquely identifying a human together with the dApp address for preventing cross reference with other dApps.
  As good practise, the dApp can also use multiple IDs for preventing cross reference between different use cases.
  For example one dApp address per topic to vote on or one dApp address per IDO pool.
*/
template HumanID(){
    signal input surname;
    signal input forename;
    signal input middlename;
    signal input yearOfBirth;
    signal input monthOfBirth;
    signal input dayOfBirth;
    signal input citizenship;
    signal input dAppAddress;
    // The salt prevents guessing the humanID
    // It is supposed to be fixed through the commitment hash and the salt registry so that each user only has one salt and one dApp specific humanID.
    signal input saltSignatureS;
    signal input saltSignatureRx;
    signal input saltSignatureRy;

    // zkCertHash as output
    signal output humanID;

    component hash = Poseidon(11);
    hash.inputs[0] <== citizenship;
    hash.inputs[1] <== dAppAddress;
    hash.inputs[2] <== dayOfBirth;
    hash.inputs[3] <== forename;
    hash.inputs[4] <== middlename;
    hash.inputs[5] <== monthOfBirth;
    hash.inputs[6] <== saltSignatureRx;
    hash.inputs[7] <== saltSignatureRy;
    hash.inputs[8] <== saltSignatureS;
    hash.inputs[9] <== surname;
    hash.inputs[10] <== yearOfBirth;

    humanID <== hash.out;
}
