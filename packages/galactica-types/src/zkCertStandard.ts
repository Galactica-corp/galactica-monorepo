/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import type { AnySchema } from 'ajv/dist/2020';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { codes, subdivision } from 'iso-3166-2';

import { contentSchemas } from './schemas';
import type {
  KYCCertificateContent,
  TwitterCertificateContent,
  REYCertificateContent,
  DEXCertificateContent,
  CEXCertificateContent,
  TelegramCertificateContent,
} from './zkCertContent';

/**
 * Type for zkCert standards. Can be a known standard or a custom standard that will be defined in the future.
 */
export type ZkCertStandard = KnownZkCertStandard | string;

/**
 * Enum for zkCert standards
 */
export enum KnownZkCertStandard {
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
 *
 * @param contentType - The type of zkCert standard to get the fields for.
 * @returns The fields of the zkCert content object in the order they are used for hashing.
 */
export function getContentFields(contentType: KnownZkCertStandard): string[] {
  let schema: any;
  switch (contentType) {
    case KnownZkCertStandard.ZkKYC:
      schema = contentSchemas.kyc;
      break;
    case KnownZkCertStandard.Twitter:
      schema = contentSchemas.twitter;
      break;
    case KnownZkCertStandard.Rey:
      schema = contentSchemas.rey;
      break;
    case KnownZkCertStandard.CEX:
      schema = contentSchemas.cex;
      break;
    case KnownZkCertStandard.DEX:
      schema = contentSchemas.dex;
      break;
    case KnownZkCertStandard.Telegram:
      schema = contentSchemas.telegram;
      break;
    case KnownZkCertStandard.ArbitraryData:
      schema = contentSchemas.simpleJson;
      break;
    // In case someone passes an invalid value:
    default:
      throw new Error(`Unknown zkCert standard: ${String(contentType)}`);
  }

  return Object.keys(schema.properties).sort();
}

/**
 * Get the schema for a zkCert standard.
 *
 * @param contentType - The type of zkCert standard to get the schema for.
 * @returns The schema for the zkCert standard.
 */
export function getContentSchema(contentType: KnownZkCertStandard): AnySchema {
  switch (contentType) {
    case KnownZkCertStandard.ZkKYC:
      return contentSchemas.kyc;
    case KnownZkCertStandard.Twitter:
      return contentSchemas.twitter;
    case KnownZkCertStandard.Rey:
      return contentSchemas.rey;
    case KnownZkCertStandard.DEX:
      return contentSchemas.dex;
    case KnownZkCertStandard.CEX:
      return contentSchemas.cex;
    case KnownZkCertStandard.Telegram:
      return contentSchemas.telegram;
    case KnownZkCertStandard.ArbitraryData:
      return contentSchemas.simpleJson;
    default:
      throw new Error(
        `Unknown zkCert standard: ${JSON.stringify(contentType)}`,
      );
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

/**
 * Parse a JSON object to a content object of a certain type. This does not convert any data types, it only validates the input data against the schema.
 *
 * @param inputData - The JSON object to parse.
 * @param schema - The schema to use for parsing.
 * @returns The parsed content object.
 */
export function parseContentJson<ContentType>(
  inputData: Record<string, unknown>,
  schema: AnySchema,
): ContentType {
  const ajv = new Ajv({
    strictSchema: true,
    allErrors: true,
    verbose: true,
  });
  ajv.addSchema(schema);
  addAJVFormats(ajv);
  const validate = ajv.compile<ContentType>(schema);
  // Unfortunately, ajv only provides the validate function for JSON schema. With JDT it would have a parser too.
  const valid = validate(inputData);
  if (!valid) {
    throw new Error(
      `Content does not fit to schema because of: ${ajv.errorsText()}, content: ${JSON.stringify(inputData)}, schema: ${JSON.stringify(schema)}`,
    );
  }

  // Set default values for optional fields that are not provided
  const res: Record<string, JSONValue> = JSON.parse(JSON.stringify(inputData));
  let schemaProperties: Record<string, { [key: string]: JSONValue }> = {};
  if (typeof schema === 'object' && schema !== null && 'properties' in schema) {
    schemaProperties = schema.properties as Record<
      string,
      { [key: string]: unknown }
    >;
  }
  let requiredList: string[] = [];
  if (typeof schema === 'object' && schema !== null && 'required' in schema) {
    requiredList = schema.required as string[];
  }
  for (const field of Object.keys(schemaProperties)) {
    if (inputData[field] === undefined && !requiredList.includes(field)) {
      if (!('default' in schemaProperties[field])) {
        throw new Error(
          `Optional field ${field} is undefined and no default value is provided.`,
        );
      }
      res[field] = schemaProperties[field].default;
    }
  }

  return res as unknown as ContentType;
}

/**
 * Add custom formats used in the zkCert standards to an Ajv instance.
 *
 * @param ajv - The Ajv instance to add the formats to.
 */
export function addAJVFormats(ajv: Ajv) {
  addFormats(ajv);
  ajv.addFormat('decimal', /^\d+$/u);
  ajv.addFormat('ethereum-address', /^0x[a-fA-F0-9]{40}$/u);
  ajv.addFormat('iso3166_1_alpha3', (value: string) => {
    return value in codes;
  });
  ajv.addFormat('iso3166_2', (value: string) => {
    return subdivision(value) !== null;
  });
  ajv.addFormat('iso3166_1_alpha3_optional', (value: string) => {
    return value === '' || value in codes;
  });
  ajv.addFormat('iso3166_2_optional', (value: string) => {
    return value === '' || subdivision(value) !== null;
  });
}
