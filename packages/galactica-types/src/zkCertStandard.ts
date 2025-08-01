/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import { contentSchemas } from './schemas';

import { KYCCertificateContent, TwitterCertificateContent, REYCertificateContent, DEXCertificateContent, CEXCertificateContent, TelegramCertificateContent } from './zkCertContent';

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

export type AnyZkCertContent =
  | KYCCertificateContent
  | TwitterCertificateContent
  | REYCertificateContent
  | DEXCertificateContent
  | CEXCertificateContent
  | TelegramCertificateContent;

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
 * @param contentType - The type of zkCert standard to get the fields for.
 * @returns The fields of the zkCert content object in the order they are used for hashing.
 */
export function getContentFields(contentType: ZkCertStandard): string[] {
  let schema: any;
  switch (contentType) {
    case ZkCertStandard.ZkKYC:
      schema = contentSchemas.kyc;
      break;
    case ZkCertStandard.Twitter:
      schema = contentSchemas.twitter;
      break;
    case ZkCertStandard.Rey:
      schema = contentSchemas.rey;
      break;
    case ZkCertStandard.CEX:
      schema = contentSchemas.cex;
      break;
    case ZkCertStandard.DEX:
      schema = contentSchemas.dex;
      break;
    case ZkCertStandard.Telegram:
      schema = contentSchemas.telegram;
      break;
    default:
      throw new Error(`Unknown zkCert standard: ${contentType}`);
  }

  return Object.keys(schema.properties).sort();
}

export function getContentSchema(contentType: ZkCertStandard): any {
  switch (contentType) {
    case ZkCertStandard.ZkKYC:
      return contentSchemas.kyc;
    case ZkCertStandard.Twitter:
      return contentSchemas.twitter;
    case ZkCertStandard.Rey:
      return contentSchemas.rey;
    case ZkCertStandard.DEX:
      return contentSchemas.dex;
    case ZkCertStandard.CEX:
      return contentSchemas.cex;
    case ZkCertStandard.Telegram:
      return contentSchemas.telegram;
    case ZkCertStandard.ArbitraryData:
      return contentSchemas.simpleJson;
    default:
      throw new Error(`Unknown zkCert standard: ${contentType}`);
  }
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
