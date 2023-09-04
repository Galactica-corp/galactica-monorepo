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
import { formatPrivKeyForBabyJub } from '../lib/keyManagement';

// sample field inputs
export const fields = {
  surname: '23742384',
  forename: '23234234',
  middlename: '12233937',
  yearOfBirth: 1982,
  monthOfBirth: 5,
  dayOfBirth: 28,
  verificationLevel: '1',
  expirationDate: 1769736098,
  streetAndNumber: '23423453234234',
  postcode: '23423453234234',
  town: '23423453234234',
  region: '23423453234234',
  country: '23423453234234',
  citizenship: '23423453234234',
  passportID: '3095472098',
};

export async function generateSampleZkKYC(): Promise<ZKCertificate> {
  // and eddsa instance for signing
  const eddsa = await buildEddsa();

  // you can change the holder to another address, the script just needs to be able to sign a message with it
  const [holder, _1, _2, KYCProvider] = await ethers.getSigners();

  const holderEdDSAKey = await getEddsaKeyFromEthSigner(holder);
  const holderCommitment = createHolderCommitment(eddsa, holderEdDSAKey);
  // TODO: create ZkKYC subclass requiring all the other fields
  let zkKYC = new ZKCertificate(
    holderCommitment,
    ZkCertStandard.ZkKYC,
    eddsa,
    1773
  );

  // set the fields in zkKYC object
  zkKYC.setContent(fields);

  // some default provider private key
  // providerData needs to be created before leafHash computation
  const providerEdDSAKey = await getEddsaKeyFromEthSigner(KYCProvider);
  zkKYC.signWithProvider(providerEdDSAKey);

  return zkKYC;
}

export async function generateZkKYCProofInput(zkKYC: ZKCertificate, amountInstitutions: number, dAppAddress: string): Promise<any> {
  // and eddsa instance for signing
  const eddsa = await buildEddsa();

  // input
  // you can change the holder to another address, the script just needs to be able to sign a message with it
  const [holder, user, encryptionAccount, KYCProvider] =
    await ethers.getSigners();
  let institutions = [];
  for (let i = 0; i < amountInstitutions; i++) {
    institutions.push((await ethers.getSigners())[4 + i]);
  }

  const holderEdDSAKey = await getEddsaKeyFromEthSigner(holder);

  // create json output file for ownership test
  let ownershipProofInput = zkKYC.getOwnershipProofInput(holderEdDSAKey);
  let authorizationProofInput = zkKYC.getAuthorizationProofInput(
    holderEdDSAKey,
    user.address
  );

  const currentTimestamp = Math.floor(Date.now() / 1000) + 10000;

  //construct the zkKYC inputs
  let zkKYCInput: any = { ...fields };

  zkKYCInput.providerAx = zkKYC.providerData.ax;
  zkKYCInput.providerAy = zkKYC.providerData.ay;
  zkKYCInput.providerS = zkKYC.providerData.s;
  zkKYCInput.providerR8x = zkKYC.providerData.r8x;
  zkKYCInput.providerR8y = zkKYC.providerData.r8y;

  // calculate zkKYC leaf hash
  let leafHash = zkKYC.leafHash;

  let encryptionPrivKey = BigInt(
    await getEddsaKeyFromEthSigner(encryptionAccount)
  ).toString();

  let humanIDProofInput = zkKYC.getHumanIDProofInput(dAppAddress, fields.passportID);

  // initiate an empty merkle tree
  let merkleTree = new MerkleTree(32, eddsa.poseidon);

  // add leaf hash as a leaf to this merkle tree
  merkleTree.insertLeaves([leafHash]);

  let merkleRoot = merkleTree.root;

  let merkleProof = merkleTree.createProof(leafHash);

  // general zkCert fields
  zkKYCInput.holderCommitment = zkKYC.holderCommitment;
  zkKYCInput.randomSalt = zkKYC.randomSalt;

  zkKYCInput.pathElements = merkleProof.pathElements;
  zkKYCInput.pathIndices = merkleProof.pathIndices;
  zkKYCInput.root = merkleRoot;
  zkKYCInput.currentTime = currentTimestamp;

  // add ownership proof inputs
  zkKYCInput.ax = ownershipProofInput.ax;
  zkKYCInput.ay = ownershipProofInput.ay;
  zkKYCInput.s = ownershipProofInput.s;
  zkKYCInput.r8x = ownershipProofInput.r8x;
  zkKYCInput.r8y = ownershipProofInput.r8y;

  // add authorization proof inputs
  zkKYCInput.userAddress = authorizationProofInput.userAddress;
  zkKYCInput.s2 = authorizationProofInput.s;
  zkKYCInput.r8x2 = authorizationProofInput.r8x;
  zkKYCInput.r8y2 = authorizationProofInput.r8y;

  // add fraud investigation data
  zkKYCInput.userPrivKey = formatPrivKeyForBabyJub(encryptionPrivKey, eddsa).toString();
  zkKYCInput.investigationInstitutionPubKey = [];
  for (let i = 0; i < institutions.length; i++) {
    let institutionPrivKey = BigInt(
      await getEddsaKeyFromEthSigner(institutions[i])
    ).toString();
    let institutionPub = eddsa.prv2pub(institutionPrivKey);

    let fraudInvestigationDataEncryptionProofInput =
      await zkKYC.getFraudInvestigationDataEncryptionProofInput(
        institutionPub,
        encryptionPrivKey
      );
    zkKYCInput.investigationInstitutionPubKey.push(
      fraudInvestigationDataEncryptionProofInput.investigationInstitutionPubkey
    );
  }

  // add humanID data
  zkKYCInput.dAppAddress = humanIDProofInput.dAppAddress;
  zkKYCInput.humanID = humanIDProofInput.humanID;

  return zkKYCInput;
}
