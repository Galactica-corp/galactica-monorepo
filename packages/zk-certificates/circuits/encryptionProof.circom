/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "privToPubKey.circom";
include "ecdh.circom";
include "mimcEncrypt.circom";

/*
  Circuit proving that a message is correctly encrypted so that the receiver can read it. 
  It is based on public private keypairs and the ECDH key exchange protocol
  (symmetric encryption key derived from sender's private key and receiver's public key = the other way around).

  In Galactica's zkKYC, this is used to proof that the KYC holder provides encrypted information for eventual fraud investigation.
*/
template encryptionProof(){
    signal input senderPrivKey;
    signal input receiverPubKey[2]; //should be public input
    signal input msg[2];

    signal output senderPubKey[2]; // becomes output (visible publicly)
    signal output encryptedMsg[2]; // becomes output (visible publicly)

    // check that the sender uses the private key for encryption that corresponds to his public key
    component privToPub = PrivToPubKey();
    privToPub.privKey <== senderPrivKey;
    senderPubKey[0] <== privToPub.pubKey[0];
    senderPubKey[1] <== privToPub.pubKey[1];

    // derive the symmetric encryption key
    component ecdh = Ecdh();
    ecdh.privKey <== senderPrivKey;
    ecdh.pubKey[0] <== receiverPubKey[0];
    ecdh.pubKey[1] <== receiverPubKey[1];

    // encrypt the msg
    component encrypt = MiMCFeistelEncrypt(220);
	encrypt.k <== ecdh.sharedKey[0]; // for MiMC we only need one element, so use first part of the shared ECDH key
	encrypt.xL_in <== msg[0];
	encrypt.xR_in <== msg[1];

	encryptedMsg[0] <== encrypt.xL_out;
	encryptedMsg[1] <== encrypt.xR_out;
}
