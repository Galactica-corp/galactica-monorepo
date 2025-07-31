/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import kycSchema from '../schema/certificate_content/kyc.json';
import twitterSchema from '../schema/certificate_content/twitter.json';
import reySchema from '../schema/certificate_content/rey.json';
import cexSchema from '../schema/certificate_content/cex.json';
import dexSchema from '../schema/certificate_content/dex.json';
import telegramSchema from '../schema/certificate_content/telegram.json';

/**
 * Enum for zkCert standards
 */
export enum ZkCertStandard {
  ZkKYC = 'gip1',
  ArbitraryData = 'gip2',
  Twitter = 'gip3',
  Rey = 'gip4',
  DEX = 'gip5',
  CEX = 'gip6',
  Telegram = 'gip7',
}

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
 * Get the fields of a ZK certificate content object in the order it is used for hashing.
 */
export function getContentFields(contentType: ZkCertStandard): string[] {
  let schema: any;
  switch (contentType) {
    case ZkCertStandard.ZkKYC:
      schema = kycSchema;
      break;
    case ZkCertStandard.Twitter:
      schema = twitterSchema;
      break;
    case ZkCertStandard.Rey:
      schema = reySchema;
      break;
    case ZkCertStandard.CEX:
      schema = cexSchema;
      break;
    case ZkCertStandard.DEX:
      schema = dexSchema;
      break;
    case ZkCertStandard.Telegram:
      schema = telegramSchema;
      break;
    default:
      throw new Error(`Unknown zkCert standard: ${contentType}`);
  }

  return Object.keys(schema.properties).sort();
}

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
