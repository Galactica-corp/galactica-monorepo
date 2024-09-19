/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import {
  twitterZkCertificateContentFields,
  ZkCertStandard,
} from '@galactica-net/galactica-types';
import { buildEddsa } from 'circomlibjs';
import { ethers } from 'hardhat';

import twitterExample from '../example/twitterFields.json';
import { prepareZkCertificateFields } from '../lib';
import {
  createHolderCommitment,
  getEddsaKeyFromEthSigner,
} from '../lib/keyManagement';
import { MerkleTree } from '../lib/merkleTree';
import { ZkCertificate } from '../lib/zkCertificate';

/**
 * Generates a sample twitter ZkCertificate object with the given fields.
 * @param fields - The fields to set in the twitter ZkCertificate object.
 * @returns Twitter ZkCertificate object promise.
 */
export async function generateSampleTwitterZkCertificate(
  fields: any = twitterExample,
): Promise<ZkCertificate> {
  // and eddsa instance for signing
  const eddsa = await buildEddsa();

  // you can change the holder to another address, the script just needs to be able to sign a message with it
  const [holder, , , guardian] = await ethers.getSigners();

  const holderEdDSAKey = await getEddsaKeyFromEthSigner(holder);
  const holderCommitment = createHolderCommitment(eddsa, holderEdDSAKey);
  const zkTwitterCertificate = new ZkCertificate(
    holderCommitment,
    ZkCertStandard.Twitter,
    eddsa,
    '1773',
    1769736098,
    twitterZkCertificateContentFields,
  );

  // set the fields in zkKYC object
  const processedFields = prepareZkCertificateFields(
    eddsa,
    fields,
    ZkCertStandard.Twitter,
  );
  zkTwitterCertificate.setContent(processedFields);

  // some default provider private key
  // providerData needs to be created before leafHash computation
  const providerEdDSAKey = await getEddsaKeyFromEthSigner(guardian);
  zkTwitterCertificate.signWithProvider(providerEdDSAKey);

  return zkTwitterCertificate;
}

/**
 * Generates the twitter ZkCertificate proof input for the twitter ZkCertificate smart contract.
 * @param twitterZkCertificate - The twitter ZkCertificate object.
 * @returns Zero Knowledge twitter proof input for the twitter ZkCertificate smart contract.
 */
export async function generateTwitterZkCertificateProofInput(
  twitterZkCertificate: ZkCertificate,
): Promise<any> {
  // and eddsa instance for signing
  const eddsa = await buildEddsa();

  // input
  // you can change the holder to another address, the script just needs to be able to sign a message with it
  const [holder, user, ,] = await ethers.getSigners();

  const holderEdDSAKey = await getEddsaKeyFromEthSigner(holder);

  // create json output file for ownership test
  const ownershipProofInput =
    twitterZkCertificate.getOwnershipProofInput(holderEdDSAKey);
  const authorizationProofInput =
    twitterZkCertificate.getAuthorizationProofInput(
      holderEdDSAKey,
      user.address,
    );

  const currentTimestamp = Math.floor(Date.now() / 1000) + 10000;

  // construct the twitterZkCertificate inputs
  const twitterZkCertificateInput: any = { ...twitterZkCertificate.content };

  twitterZkCertificateInput.providerAx = twitterZkCertificate.providerData.ax;
  twitterZkCertificateInput.providerAy = twitterZkCertificate.providerData.ay;
  twitterZkCertificateInput.providerS = twitterZkCertificate.providerData.s;
  twitterZkCertificateInput.providerR8x = twitterZkCertificate.providerData.r8x;
  twitterZkCertificateInput.providerR8y = twitterZkCertificate.providerData.r8y;

  // calculate twitterZkCertificate leaf hash
  const { leafHash } = twitterZkCertificate;

  // initiate an empty merkle tree
  const merkleTree = new MerkleTree(32, eddsa.poseidon);

  // add leaf hash as a leaf to this merkle tree
  merkleTree.insertLeaves([leafHash]);

  const merkleRoot = merkleTree.root;

  const merkleProof = merkleTree.createProof(leafHash);

  // general zkCert fields
  twitterZkCertificateInput.holderCommitment =
    twitterZkCertificate.holderCommitment;
  twitterZkCertificateInput.randomSalt = twitterZkCertificate.randomSalt;
  twitterZkCertificateInput.expirationDate =
    twitterZkCertificate.expirationDate;

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
