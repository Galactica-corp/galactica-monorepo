/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import { SNARK_SCALAR_FIELD } from './snark';

/**
 * The types a value might have that is passed to a zk circuit.
 */
export type FieldElement = string | number | boolean | bigint;

/**
 * Check if a value is a valid field element.
 * @param value - The value to check.
 * @returns A valid field element.
 * @throws An error if the field element is not valid.
 */
export function parseFieldElement(value: FieldElement): FieldElement {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean' &&
    typeof value !== 'bigint'
  ) {
    throw new Error(`Invalid field element type: ${typeof value}`);
  }

  let processedValue: FieldElement = value;
  if (typeof processedValue === 'string') {
    processedValue = processedValue.trim();
    // Check if the string is a valid integer representation (decimal or hex)
    // Accepts decimal digits, or 0x/0X hex notation
    if (!/^(0[xX][0-9a-fA-F]+|\d+)$/u.test(processedValue)) {
      throw new Error(`String field element is not a valid positive integer (decimal or hex): ${processedValue}`);
    }
    try {
      processedValue = BigInt(processedValue);
    } catch (error) {
      throw new Error(`String field element cannot be converted to BigInt: ${processedValue}, because: ${processedValue}`);
    }
  }

  if (typeof processedValue === 'boolean') {
    processedValue = processedValue ? 1n : 0n;
  }

  if (typeof processedValue === 'number') {
    // Check for special numbers that can't be converted to BigInt
    if (
      !Number.isInteger(processedValue)
    ) {
      throw new Error(`Field element is not in 'mod SNARK_SCALAR_FIELD': ${processedValue}`);
    }

    try {
      processedValue = BigInt(processedValue);
    } catch (error) {
      throw new Error(`Number field element cannot be converted to BigInt: ${processedValue}, because: ${error}`);
    }
  }

  if (processedValue < 0n || processedValue >= SNARK_SCALAR_FIELD) {
    throw new Error(`Field element is not in 'mod SNARK_SCALAR_FIELD': ${processedValue}`);
  }

  return processedValue;
}
