/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import type { FieldElement } from '@galactica-net/galactica-types';
import { parseFieldElement } from '@galactica-net/galactica-types';
import type { AnySchema } from 'ajv';
import type { Eddsa } from 'circomlibjs';
import { Temporal } from 'temporal-polyfill';

import { hashStringToFieldNumber } from './helpers';

/**
 * Function preparing the fields for  ZkCertificate depending on its types.
 * It hashes all string fields to be representable in zk circuits.
 *
 * @param eddsa - Eddsa object from circomlibjs.
 * @param contentData - Input certificate data to be verified and hashed if necessary.
 * @param contentSchema - JSON Schema of the content containing information about the fields and how to provide them to the zk circuit.
 * @returns Object with the ZkCert content how it can be passed to the ZK circuit.
 * @throws Error if any of the required fields is missing.
 */
export function prepareContentForCircuit<
  Content extends Record<string, unknown>,
>(
  eddsa: Eddsa,
  contentData: Content,
  contentSchema: AnySchema,
): Record<keyof Content, FieldElement> {
  const contentFields: Record<string, FieldElement> = {};

  let schemaProperties: Record<string, Record<string, unknown>> = {};
  let zkCertificateContentFields: string[];
  if (
    typeof contentSchema === 'object' &&
    contentSchema !== null &&
    'properties' in contentSchema
  ) {
    schemaProperties = contentSchema.properties as Record<
      string,
      Record<string, unknown>
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
        schemaProperties[field] === undefined || // handle case where field is not defined in the schema, such as in gip2
        !('default' in schemaProperties[field]) ||
        schemaProperties[field].default === undefined
      ) {
        throw new Error(
          `Certificate field ${field} is undefined and no default value is provided in the schema.`,
        );
      }
      sourceData = schemaProperties[field].default;
    }

    if (typeof sourceData === 'boolean') {
      // we might be able to take the data 1 to 1 as field element
      resValue = parseFieldElement(sourceData);
    } else if (typeof sourceData === 'bigint') {
      // we might be able to take the data 1 to 1 as field element
      resValue = parseFieldElement(sourceData);
    } else if (typeof sourceData === 'number') {
      // Check if the field type is 'number' in the schema (for float64 handling)
      // JSON Schema uses 'number' for floats and 'integer' for integers
      const fieldType = schemaProperties[field]?.type;
      if (fieldType === 'number') {
        // Convert float64 to big integer with 18 decimal places for blockchain compatibility
        // This matches the Go implementation's scoreToFixedPoint function
        resValue = floatToBigInt(sourceData, 18);
      } else {
        // Integer type ('integer' in schema), can be passed as is
        resValue = parseFieldElement(sourceData);
      }
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
        case 'case-insensitive':
          // convert to lower case before hashing, for example because 'AStar_Gala' and 'astar_gala' lead to the same X account
          resValue = hashStringToFieldNumber(
            sourceData.toLowerCase(),
            eddsa.poseidon,
          );
          break;
        default:
          throw new Error(
            `No conversion for string format ${String(format)} to a ZK field element implemented. Required for field ${String(field)}: ${String(sourceData)}`,
          );
      }
    } else if (typeof sourceData === 'object') {
      // We can extend this in the future to support the new circom 2 feature https://docs.circom.io/circom-language/buses/
      throw new Error(
        `Nested objects are not supported yet for conversion to ZK field elements. Required for field ${String(field)}: ${JSON.stringify(sourceData)}`,
      );
    } else {
      throw new Error(
        `No conversion from JS type: ${typeof sourceData} to a ZK field element implemented. Required for field ${String(field)}: ${JSON.stringify(sourceData)}`,
      );
    }

    contentFields[field] = resValue;
  }

  return contentFields as Record<keyof Content, FieldElement>;
}

/**
 * Converts a float64 to a BigInt by multiplying by 10^decimals to preserve decimal precision.
 * This matches the Go implementation's scoreToFixedPoint function for blockchain compatibility.
 * Uses string manipulation to avoid floating point precision issues.
 *
 * @param value - The float64 value to convert.
 * @param decimals - Number of decimal places to preserve (typically 18 for blockchain).
 * @returns BigInt representation with preserved decimal precision.
 */
export function floatToBigInt(value: number, decimals: number): bigint {
  // Convert to string to avoid floating point precision issues
  const valueStr = value.toString();

  // Split into integer and decimal parts
  const [integerPart = '0', decimalPart = ''] = valueStr.split('.');

  // Pad or truncate decimal part to desired length
  const paddedDecimalPart = decimalPart
    .padEnd(decimals, '0')
    .slice(0, decimals);

  // Combine integer and decimal parts
  const combinedStr = integerPart + paddedDecimalPart;

  // Convert to BigInt
  return BigInt(combinedStr);
}

/**
 * Converts a date string to a unix timestamp to be used in zk circuits.
 *
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
 *
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
