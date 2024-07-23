/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

include "../merkleProof.circom";
include "../authorization.circom";
include "../mimcEncrypt.circom";
include "../../../../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Experimental circuit to combine reputation data from multiple accounts into a single reputation score.
 *
 * @param reputationTreeLevels - Number of levels of the reputation merkle tree.
 * @param accounts - Number of accounts to combine reputation of.
 * @param accountTreeLevels - Number of levels of the accoutn list merkle tree.
 */
template CrossAccountReputation(reputationTreeLevels, accounts, accountTreeLevels){
    // data making up the leaf hash of the reputation merkle tree
    signal input addresses[accounts];
    signal input reputation[accounts];

    // variables related to the merkle proof
    signal input pathElements[accounts][reputationTreeLevels];
    signal input leafIndex[accounts];
    signal input root;

    // UTXO proof of the account list
    // This enforces that the user includes all accounts in the reputation calculation.
    // signal input accountListRoot;
    // signal input accountListPathElements[accountTreeLevels];
    // signal input accountListLeafIndex;

    signal output totalReputation;
    // The output UTXO of the account list
    // signal output utxoCommitment;

    component leafHashes[accounts];
    component merkleProofs[accounts];
    for (var a = 0; a < accounts; a++) {
        // calculate the leaf hash
        leafHashes[a] = Poseidon(2);
        leafHashes[a].inputs[0] <== addresses[a];
        leafHashes[a].inputs[1] <== reputation[a];

        // checking the merkle proof
        merkleProofs[a] = MerkleProof(reputationTreeLevels);
        // use the merkle proof component to calculate the root
        merkleProofs[a].leaf <== reputation[a]; // TODO: use leafHashes[a].out;
        for (var i = 0; i < reputationTreeLevels; i++) {
            merkleProofs[a].pathElements[i] <== pathElements[a][i];
        }
        merkleProofs[a].leafIndex <== leafIndex[a];

        // check that the calculated root is equal to the public root
        root === merkleProofs[a].root;
    }

    // // the accountListTree leaf hash is the poseidon hash of the account addresses
    // component accountListLeafHash = Poseidon(accounts);
    // for (var a = 0; a < accounts; a++) {
    //     accountListLeafHash.inputs[a] <== addresses[a];
    // }

    // // check the account list merkle proof
    // component accountListMerkleProof = MerkleProof(accountTreeLevels);
    // accountListMerkleProof[a].leaf <== accountListLeafHash.out;
    // for (var i = 0; i < accountTreeLevels; i++) {
    //     accountListMerkleProof.pathElements[i] <== accountListPathElements[i];
    // }
    // accountListMerkleProof.leafIndex <== accountListLeafIndex;
    // accountListRoot === accountListMerkleProof.root;

    // the output UTXO commitment stays the hash of the account list root because it is not changed
    // utxoCommitment <== accountListRoot;

    // calculate the total reputation score
    // total teputation is the sum the reputation scores of each account
    signal sum[accounts];
    sum[0] <== reputation[0];
    for (var a = 1; a < accounts; a++) {
        sum[a] <== sum[a-1] + reputation[a];
    }
    totalReputation <== sum[accounts-1];

    // TODO: ignore unused account entires in the account list in merkle proof
    // TODO: ignore unused account entires in the account list in reputation calculation
    // TODO: encrypt account list utxo (poseidon hash with priv key as in Tornado, or with eddsa to let guardian provide empty list (maybe with transformation option before))
    // TODO: use blinding in account list utxo
    // TODO: nullifier logic
    // TODO: reputation tree leaf is a triplet including a hash of the used reputation function

    // dummy computation to estimate circuit size
    // outputting leaf hash calculation
    signal output leafHashesOut[accounts];
    for (var a = 0; a < accounts; a++) {
        leafHashesOut[a] <== leafHashes[a].out;
    }
    // 2 signatures for account list
    // message to be signed, this will be a public input so the SC can compare it with the onchain message sender
    signal input userAddress[2];
    // pubkey of the account behind holder commitment
    signal input ax[2];
    signal input ay[2];
    // EdDSA signature
    signal input s[2];
    signal input r8x[2];
    signal input r8y[2];

    component eddsa[2];
    for (var i = 0; i < 2; i++) {
        eddsa[i] = Authorization();
        eddsa[i].userAddress <== userAddress[i];
        eddsa[i].ax <== ax[i];
        eddsa[i].ay <== ay[i];
        eddsa[i].s <== s[i];
        eddsa[i].r8x <== r8x[i];
        eddsa[i].r8y <== r8y[i];
    }

    // encrypt and decrypt of account list
	signal output xL_out;
	signal output xR_out;
	component encrypt = MiMCFeistelEncrypt(220);
	component decrypt = MiMCFeistelDecrypt(220);
	encrypt.xL_in <== eddsa[0].userAddress;
	encrypt.xR_in <== eddsa[1].userAddress;
	encrypt.k <== reputation[accounts-1];

	decrypt.xL_in <== encrypt.xL_out;
	decrypt.xR_in <== encrypt.xR_out;
	decrypt.k <== root;

	decrypt.xL_out ==> xL_out;
	decrypt.xR_out ==> xR_out;
}

component main {public [
  root
]} = CrossAccountReputation(32, 9, 32); // 1 additional merkle proof for account list
