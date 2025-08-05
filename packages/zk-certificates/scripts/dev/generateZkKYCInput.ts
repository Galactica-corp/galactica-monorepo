/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { buildEddsa } from 'circomlibjs';
import { ethers } from 'hardhat';

import { ZkCertStandard, prepareContentForCircuit } from '../../lib';
import {
  createHolderCommitment,
  formatPrivKeyForBabyJub,
  getEddsaKeyFromEthSigner,
} from '../../lib/keyManagement';
import { MerkleTree } from '../../lib/merkleTree';
import { ZkCertificate } from '../../lib/zkCertificate';
import { getHumanIDProofInput } from '../../lib/zkKYC';
import { getContentSchema, KYCCertificateContent } from '@galactica-net/galactica-types';
import kycExample from '../../example/kycFields.json';

/**
 * Generates a sample ZkKYC object with the given fields.
 * @returns ZkKYC object promise.
 */
export async function generateSampleZkKYC(): Promise<ZkCertificate> {
  // and eddsa instance for signing
  const eddsa = await buildEddsa();

  // you can change the holder to another address, the script just needs to be able to sign a message with it
  const signers = await ethers.getSigners();
  const holder = signers[0];
  const KYCProvider = signers[3];

  const holderEdDSAKey = await getEddsaKeyFromEthSigner(holder);
  const holderCommitment = createHolderCommitment(eddsa, holderEdDSAKey);
  const zkKYC = new ZkCertificate(
    holderCommitment,
    ZkCertStandard.ZkKYC,
    eddsa,
    '1773',
    1769736098,
    getContentSchema(ZkCertStandard.ZkKYC),
    kycExample as KYCCertificateContent,
  );

  // some default provider private key
  // providerData needs to be created before leafHash computation
  const providerEdDSAKey = await getEddsaKeyFromEthSigner(KYCProvider);
  zkKYC.signWithProvider(providerEdDSAKey);

  return zkKYC;
}

/**
 * Generates the zkKYC proof input for the zkKYC smart contract.
 * @param zkKYC - The zkKYC object.
 * @param amountInstitutions - The amount of institutions to use for fraud investigation.
 * @param dAppAddress - The address of the DApp smart contract.
 * @param merkleTreeDepth - The depth of the registration Merkle tree.
 * @param holder - The holder of the zkKYC.
 * @param user - The user of the zkKYC.
 * @param encryptionAccount - The encryption account of the zkKYC.
 * @returns Zero Knowledge KYC proof input for the zkKYC smart contract.
 */
export async function generateZkKYCProofInput(
  zkKYC: ZkCertificate,
  amountInstitutions: number,
  dAppAddress: string,
  merkleTreeDepth = 32,
  holder: SignerWithAddress | null = null,
  user: SignerWithAddress | null = null,
  encryptionAccount: SignerWithAddress | null = null,
): Promise<any> {
  // and eddsa instance for signing
  const eddsa = await buildEddsa();

  // input
  // you can change the holder to another address, the script just needs to be able to sign a message with it
  const [_holder, _user, _encryptionAccount] = await ethers.getSigners();
  if (holder === null) {
    // eslint-disable-next-line no-param-reassign
    holder = _holder;
  }
  if (user === null) {
    // eslint-disable-next-line no-param-reassign
    user = _user;
  }
  if (encryptionAccount === null) {
    // eslint-disable-next-line no-param-reassign
    encryptionAccount = _encryptionAccount;
  }
  const institutions = [];
  for (let i = 0; i < amountInstitutions; i++) {
    institutions.push((await ethers.getSigners())[4 + i]);
  }

  const holderEdDSAKey = await getEddsaKeyFromEthSigner(holder);

  // create json output file for ownership test
  const ownershipProofInput = zkKYC.getOwnershipProofInput(holderEdDSAKey);
  const authorizationProofInput = zkKYC.getAuthorizationProofInput(
    holderEdDSAKey,
    await user.getAddress(),
  );

  const currentTimestamp = Math.floor(Date.now() / 1000) + 10000;

  // construct the zkKYC inputs
  const zkKYCInput: any = prepareContentForCircuit(eddsa, zkKYC.content, getContentSchema(ZkCertStandard.ZkKYC));

  zkKYCInput.providerAx = zkKYC.providerData.ax;
  zkKYCInput.providerAy = zkKYC.providerData.ay;
  zkKYCInput.providerS = zkKYC.providerData.s;
  zkKYCInput.providerR8x = zkKYC.providerData.r8x;
  zkKYCInput.providerR8y = zkKYC.providerData.r8y;

  // calculate zkKYC leaf hash
  const { leafHash } = zkKYC;

  const encryptionPrivKey = await getEddsaKeyFromEthSigner(encryptionAccount);

  const humanIDProofInput = getHumanIDProofInput(dAppAddress);

  // initiate an empty merkle tree
  const merkleTree = new MerkleTree(merkleTreeDepth, eddsa.poseidon);

  // add leaf hash as a leaf to this merkle tree
  merkleTree.insertLeaves([leafHash]);

  const merkleRoot = merkleTree.root;

  const merkleProof = merkleTree.createProof(leafHash);

  // general zkCert fields
  zkKYCInput.holderCommitment = zkKYC.holderCommitment;
  zkKYCInput.randomSalt = zkKYC.randomSalt;
  zkKYCInput.expirationDate = zkKYC.expirationDate;

  zkKYCInput.pathElements = merkleProof.pathElements;
  zkKYCInput.leafIndex = merkleProof.leafIndex;
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
  zkKYCInput.userPrivKey = formatPrivKeyForBabyJub(
    encryptionPrivKey,
    eddsa,
  ).toString();
  zkKYCInput.investigationInstitutionPubKey = [];
  for (const inst of institutions) {
    const institutionPrivKey = await getEddsaKeyFromEthSigner(inst);
    const institutionPub = eddsa.prv2pub(institutionPrivKey);

    const fraudInvestigationDataEncryptionProofInput =
      await zkKYC.getFraudInvestigationDataEncryptionProofInput(
        institutionPub,
        encryptionPrivKey,
      );
    zkKYCInput.investigationInstitutionPubKey.push(
      fraudInvestigationDataEncryptionProofInput.investigationInstitutionPubkey,
    );
  }

  // add humanID data
  zkKYCInput.dAppAddress = humanIDProofInput.dAppAddress;

  return zkKYCInput;
}
