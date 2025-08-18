/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type {
  FieldElement,
  ZkCertRegistered,
} from '@galactica-net/galactica-types';
import { parseFieldElement } from '@galactica-net/galactica-types';
import { Temporal } from '@js-temporal/polyfill';
import type { AnySchema } from 'ajv';
import { Buffer } from 'buffer';
import type { Eddsa } from 'circomlibjs';

import { hashStringToFieldNumber } from './helpers';

/**
 * Function preparing the fields for  ZkCertificate depending on its types.
 * It hashes all string fields to be representable in zk circuits.
 * @param eddsa - Eddsa object from circomlibjs.
 * @param contentData - Input certificate data to be verified and hashed if necessary.
 * @param contentSchema - JSON Schema of the content containing information about the fields and how to provide them to the zk circuit.
 * @returns Object with the ZkCert content how it can be passed to the ZK circuit.
 * @throws Error if any of the required fields is missing.
 */
export function prepareContentForCircuit(
  eddsa: Eddsa,
  contentData: Record<string, unknown>,
  contentSchema: AnySchema,
): Record<string, FieldElement> {
  const contentFields: Record<string, FieldElement> = {};

  let schemaProperties: Record<string, { [key: string]: unknown }> = {};
  let zkCertificateContentFields;
  if (
    typeof contentSchema === 'object' &&
    contentSchema !== null &&
    'properties' in contentSchema
  ) {
    schemaProperties = contentSchema.properties as Record<
      string,
      { [key: string]: unknown }
    >;
    zkCertificateContentFields = Object.keys(schemaProperties);
  } else {
    // use keys of content directly if no properties are defined in the schema (gip2)
    zkCertificateContentFields = Object.keys(contentData);
  }

  for (const field of zkCertificateContentFields) {
    let resValue: FieldElement;
    let sourceData = contentData[field];

    if (sourceData === undefined) {
      // Zk circuits need data to be provided for all fields, so we set default values for optional fields that are not provided
      if (
        !('default' in schemaProperties[field]) ||
        schemaProperties[field].default === undefined
      ) {
        throw new Error(
          `Certificate field ${field} is undefined and no default value is provided in the schema.`,
        );
      }
      sourceData = schemaProperties[field].default;
    }

    if (
      typeof sourceData === 'number' ||
      typeof sourceData === 'bigint' ||
      typeof sourceData === 'boolean'
    ) {
      // we might be able to take the data 1 to 1 as field element
      resValue = parseFieldElement(sourceData);
    } else if (typeof sourceData === 'string') {
      // the meaning of the string depends on the format.
      const format = schemaProperties[field]?.format;
      switch (format) {
        // going through built-in formats found in https://json-schema.org/understanding-json-schema/reference/type#format
        case 'date-time':
          resValue = dateStringToUnixTimestamp(sourceData);
          break;
        case 'time':
          // pass the number of seconds since midnight
          // sourceData is expected to be a string in "HH:MM:SS" or "HH:MM" format
          // eslint-disable-next-line no-case-declarations
          const [hours, minutes, seconds] = sourceData.split(':').map(Number);
          resValue = (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0);
          break;
        case 'date':
          // pass it as unix timestamp
          resValue = dateStringToUnixTimestamp(`${sourceData}T00:00:00Z`);
          break;
        case 'duration':
          resValue = Temporal.Duration.from(sourceData).total({
            unit: 'seconds',
          });
          break;

        // formats that are passed as hashed string to the circuit
        // we hash the string to a field element to be able to use it efficiently in the circuit for comparisons and further hashing.
        // this can be extended in the future to decide when to pass the string as char array to the circuit. This is less efficient, but allows use cases, such as proving that a name starts with a certain character.
        case 'string':
        case 'email':
        case 'idn-email':
        case 'hostname':
        case 'ipv4':
        case 'ipv6':
        case 'uuid':
        case 'uri':
        case 'uri-reference':
        case 'iri':
        case 'iri-reference':
        case 'regex':
        case 'iso3166_1_alpha3': // country code
        case 'iso3166_2': // region code
        case 'iso3166_1_alpha3_optional': // country code
        case 'iso3166_2_optional': // region code
        case undefined:
          // no format specified, so we assume it is a string that is not meant for something else, such as a name or address
          resValue = hashStringToFieldNumber(sourceData, eddsa.poseidon);
          break;

        // Galactica specific formats
        case 'field-element': // can be passed as is
        case 'ethereum-address': // can be passed as is because it is a hex string
        case 'decimal':
          resValue = parseFieldElement(sourceData);
          break;
        default:
          throw new Error(
            `No conversion for string format ${String(format)} to a ZK field element implemented. Required for field ${String(field)}: ${String(sourceData)}`,
          );
      }
    } else if (typeof sourceData === 'object') {
      // We can extend this in the future to support the new circom 2 feature https://docs.circom.io/circom-language/buses/
      throw new Error(
        `Nested objects are not supported yet for conversion to ZK field elements. Required for field ${String(field)}: ${String(sourceData)}`,
      );
    } else {
      throw new Error(
        `No conversion from JS type: ${typeof sourceData} to a ZK field element implemented. Required for field ${String(field)}: ${String(sourceData)}`,
      );
    }

    contentFields[field] = resValue;
  }

  return contentFields;
}

/**
 * Converts a date string to a unix timestamp to be used in zk circuits.
 * @param date - Date string in RFC3339 format or unix timestamp.
 * @returns Unix timestamp.
 */
export function dateStringToUnixTimestamp(date: string): number {
  // check if the date is given as RFC3339 string
  if (date.includes('T')) {
    return Math.floor(new Date(date).getTime() / 1000);
  }
  // check if the date is given as unix timestamp
  if (date.length === 10 && !isNaN(parseInt(date, 10))) {
    return parseInt(date, 10);
  }
  throw new Error(
    `Invalid date format (neither RFC3339 nor unix timestamp): ${date}`,
  );
}

/**
 * Hashes the content of a ZkCertificate into the contentHash of the ZkCertificate.
 * @param eddsa - Eddsa object from circomlibjs.
 * @param contentData - Content of the zkCertificate to hash.
 * @param contentSchema - JSON Schema of the content containing information about the fields and how to provide them to the zk circuit.
 * @returns Hashed content of the ZkCertificate.
 */
export function hashZkCertificateContent(
  eddsa: Eddsa,
  contentData: any,
  contentSchema: any,
): string {
  const contentFields = prepareContentForCircuit(
    eddsa,
    contentData,
    contentSchema,
  );

  return eddsa.F.toObject(
    eddsa.poseidon(
      // sort the fields alphabetically to ensure the same order as in the circuit
      Object.keys(contentFields)
        .sort()
        .map((field) => contentFields[field]),
      undefined,
      1,
    ),
  ).toString();
}

/**
 * Workaround for a bug in the encryption library. With certain data sizes, the encryption fails to pad the data correctly. So we additionally inflate the data to make sure it is padded correctly.
 * @param data - ZkCert to pad.
 * @returns Encrypted zkCert.
 */
export function padZkCertForEncryption<Content = any>(
  data: ZkCertRegistered<Content>,
): ZkCertRegistered<Content> {
  const dataWithPadding = {
    data,
    padding: '',
  };
  const dataLength = Buffer.byteLength(
    JSON.stringify(dataWithPadding),
    'utf-8',
  );
  const DEFAULT_PADDING_LENGTH = 2 ** 11;
  const NACL_EXTRA_BYTES = 16;
  const modVal = dataLength % DEFAULT_PADDING_LENGTH;
  const padLength = DEFAULT_PADDING_LENGTH - modVal - NACL_EXTRA_BYTES;
  if (padLength < 0) {
    data.paddingIssueWorkaround = '0'.repeat(NACL_EXTRA_BYTES);
  }
  return data;
}
