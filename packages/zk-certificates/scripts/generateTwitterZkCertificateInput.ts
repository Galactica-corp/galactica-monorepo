/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { buildEddsa } from 'circomlibjs';
import { ZKCertificate } from '../lib/zkCertificate';
import {
  createHolderCommitment,
  getEddsaKeyFromEthSigner,
} from '../lib/keyManagement';
import { MerkleTree } from '../lib/merkleTree';
import { ethers } from 'hardhat';
import { ZkCertStandard } from '../lib';
import { twitterZkCertificateContentFields} from '@galactica-net/galactica-types';
import { formatPrivKeyForBabyJub } from '../lib/keyManagement';

// sample field inputs
export const fields = {
  accountId: '23742384',
  creationTime: '23234234',
  location: '12233937',
  verified: 1,
  followersCount: 5,
  friendsCount: 28,
  likesCount: 10,
  postsCount: 22,
  expirationTime: 1769736098,
};

export async function generateSampleTwitterZkCertificate(): Promise<ZKCertificate> {
  // and eddsa instance for signing
  const eddsa = await buildEddsa();

  // you can change the holder to another address, the script just needs to be able to sign a message with it
  const [holder, _1, _2, guardian] = await ethers.getSigners();

  const holderEdDSAKey = await getEddsaKeyFromEthSigner(holder);
  const holderCommitment = createHolderCommitment(eddsa, holderEdDSAKey);

  let zkTwitterCertificate = new ZKCertificate(
    holderCommitment,
    ZkCertStandard.TwitterZkCertificate,
    eddsa,
    1773,
    twitterZkCertificateContentFields
  );

  // set the fields in zkKYC object
  zkTwitterCertificate.setContent(fields);

  // some default provider private key
  // providerData needs to be created before leafHash computation
  const providerEdDSAKey = await getEddsaKeyFromEthSigner(guardian);
  zkTwitterCertificate.signWithProvider(providerEdDSAKey);

  return zkTwitterCertificate;
}

export async function generateTwitterZkCertificateProofInput(twitterZkCertificate: ZKCertificate): Promise<any> {
  // and eddsa instance for signing
  const eddsa = await buildEddsa();

  // input
  // you can change the holder to another address, the script just needs to be able to sign a message with it
  const [holder, user, _, guardian] =
    await ethers.getSigners();

  const holderEdDSAKey = await getEddsaKeyFromEthSigner(holder);

  // create json output file for ownership test
  let ownershipProofInput = twitterZkCertificate.getOwnershipProofInput(holderEdDSAKey);
  let authorizationProofInput = twitterZkCertificate.getAuthorizationProofInput(
    holderEdDSAKey,
    user.address
  );

  const currentTimestamp = Math.floor(Date.now() / 1000) + 10000;

  //construct the twitterZkCertificate inputs
  let twitterZkCertificateInput: any = { ...fields };

  twitterZkCertificateInput.providerAx = twitterZkCertificate.providerData.ax;
  twitterZkCertificateInput.providerAy = twitterZkCertificate.providerData.ay;
  twitterZkCertificateInput.providerS = twitterZkCertificate.providerData.s;
  twitterZkCertificateInput.providerR8x = twitterZkCertificate.providerData.r8x;
  twitterZkCertificateInput.providerR8y = twitterZkCertificate.providerData.r8y;

  // calculate twitterZkCertificate leaf hash
  let leafHash = twitterZkCertificate.leafHash;

  // initiate an empty merkle tree
  let merkleTree = new MerkleTree(32, eddsa.poseidon);

  // add leaf hash as a leaf to this merkle tree
  merkleTree.insertLeaves([leafHash]);

  let merkleRoot = merkleTree.root;

  let merkleProof = merkleTree.createProof(leafHash);

  // general zkCert fields
  twitterZkCertificateInput.holderCommitment = twitterZkCertificate.holderCommitment;
  twitterZkCertificateInput.randomSalt = twitterZkCertificate.randomSalt;

  twitterZkCertificateInput.pathElements = merkleProof.pathElements;
  twitterZkCertificateInput.leafIndex = merkleProof.leafIndex;
  twitterZkCertificateInput.root = merkleRoot;
  twitterZkCertificateInput.currentTime = currentTimestamp;

  // add ownership proof inputs
  twitterZkCertificateInput.ax = ownershipProofInput.ax;
  twitterZkCertificateInput.ay = ownershipProofInput.ay;
  twitterZkCertificateInput.s = ownershipProofInput.s;
  twitterZkCertificateInput.r8x = ownershipProofInput.r8x;
  twitterZkCertificateInput.r8y = ownershipProofInput.r8y;

  // add authorization proof inputs
  twitterZkCertificateInput.userAddress = authorizationProofInput.userAddress;
  twitterZkCertificateInput.s2 = authorizationProofInput.s;
  twitterZkCertificateInput.r8x2 = authorizationProofInput.r8x;
  twitterZkCertificateInput.r8y2 = authorizationProofInput.r8y;

  return twitterZkCertificateInput;
}
