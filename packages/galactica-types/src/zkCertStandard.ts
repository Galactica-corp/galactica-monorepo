/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

/**
 * Enum for zkCert standards
 */
export enum ZkCertStandard {
  ZkKYC = 'gip1',
  ArbitraryData = 'gip2',
  Twitter = 'gip3',
  Rey = 'gip4',
  Exchange = 'gip5',
}

/**
 * Data specifically contained in zkKYC
 */
export type ZkKYCContent = {
  surname: string;
  forename: string;
  middlename: string;

  yearOfBirth: string;
  monthOfBirth: string;
  dayOfBirth: string;

  citizenship: string;

  verificationLevel: string;

  streetAndNumber: string;
  postcode: string;
  town: string;
  region: string;
  country: string;
};

/**
 * Ordered list of fields common to all zkCerts.
 */
export const zkCertCommonFields = [
  'contentHash',
  'expirationDate',
  'holderCommitment',
  'providerAx',
  'providerAy',
  'providerR8x',
  'providerR8y',
  'providerS',
  'randomSalt',
];

/**
 * Ordered list of fields contained specifically in the zkKYC.
 * It does not include fields that are common to all zkCerts.
 */
export const zkKYCContentFields: (keyof ZkKYCContent)[] = [
  'citizenship',
  'country',
  'dayOfBirth',
  'forename',
  'middlename',
  'monthOfBirth',
  'postcode',
  'region',
  'streetAndNumber',
  'surname',
  'town',
  'verificationLevel',
  'yearOfBirth',
];

/**
 * List of fields in zkKYC that are optional. They are still included in a zkKYC, but can be empty.
 */
export const zkKYCOptionalContent: (keyof ZkKYCContent)[] = [
  'postcode',
  'region',
  'streetAndNumber',
  'town',
];

/**
 * Ordered list of fields determining the DApp specific Human ID.
 */
export const humanIDFieldOrder = [
  'citizenship',
  'dAppAddress',
  'dayOfBirth',
  'forename',
  'middlename',
  'monthOfBirth',
  'saltSignatureRx',
  'saltSignatureRy',
  'saltSignatureS',
  'surname',
  'yearOfBirth',
];

/**
 * Ordered list of fields determining the person ID to register a unique salt in the salt registry.
 */
export const personIDFieldOrder = [
  'citizenship',
  'dayOfBirth',
  'forename',
  'middlename',
  'monthOfBirth',
  'surname',
  'yearOfBirth',
];

/**
 * Data specifically contained in twitterZkCertificate
 */
export type TwitterZkCertificateContent = {
  createdAt: number;
  id: string;
  followersCount: number;
  followingCount: number;
  listedCount: number;
  tweetCount: number;
  username: string;
  verified: boolean;
};

/**
 * Ordered list of fields contained specifically in the twitterZkCertificate.
 * It does not include fields that are common to all zkCerts.
 */
export const twitterZkCertificateContentFields: (keyof TwitterZkCertificateContent)[] =
  [
    'createdAt',
    'followersCount',
    'followingCount',
    'id',
    'listedCount',
    'tweetCount',
    'username',
    'verified',
  ];

// disabled eslint rule for naming convention because the field names are defined by the standard
/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Data specifically contained in reyZkCertificate
 */
export type ReyZkCertificateContent = {
  x_id: string;
  x_username: string;
  rey_score_all: number;
  rey_score_galactica: number;
  rey_faction: number;
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Ordered list of fields contained specifically in the reyZkCertificate.
 * It does not include fields that are common to all zkCerts.
 */
export const reyZkCertificateContentFields: (keyof ReyZkCertificateContent)[] =
  ['rey_faction', 'rey_score_all', 'rey_score_galactica', 'x_id', 'x_username'];

/**
 * Data specifically contained in DEX/CEX Certificates.
 * The numerical values are defined as strings so they can fit into the field even if they exceed the JS number range.
 */
export type ExchangeZkCertificateContent = {
  address: string;
  totalSwapVolume: string;
  swapVolumeYear: string;
  swapVolumeHalfYear: string;
};

/**
 * Ordered list of fields contained specifically in the DEX/CEX Certificates.
 * It does not include fields that are common to all zkCerts.
 */
export const exchangeZkCertificateContentFields: (keyof ExchangeZkCertificateContent)[] =
  ['address', 'swapVolumeHalfYear', 'swapVolumeYear', 'totalSwapVolume'];
