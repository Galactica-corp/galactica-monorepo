/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import { SNARK_SCALAR_FIELD } from "./snark";


/**
 * The types a value might have that is passed to a zk circuit.
 */
export type FieldElement = string | number | boolean | bigint;


/**
 * Check if a value is a valid field element.
 * @param value - The value to check.
 * @returns An object with the validity of the field element and an error message if it is not valid.
 */
export function isValidFieldElement(value: FieldElement): { valid: boolean, error?: string } {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean' && typeof value !== 'bigint') {
    return { valid: false, error: `Invalid field element type: ${typeof value}` };
  }

  if (typeof value === 'string') {
    // Check if the string is a valid integer representation (decimal or hex)
    // Accepts decimal digits, or 0x/0X hex notation
    if (
      !/^\s*(0[xX][0-9a-fA-F]+|\d+)\s*$/.test(value)
    ) {
      return { valid: false, error: `String field element is not a valid positive integer (decimal or hex): ${value}` };
    }
    try {
      value = BigInt(value);
    } catch (e) {
      return { valid: false, error: `String field element cannot be converted to BigInt: ${value}` };
    }
  }

  if (typeof value === 'boolean') {
    value = value ? 1n : 0n;
  }

  if (typeof value === 'number') {
    // Check for special numbers that can't be converted to BigInt
    if (Number.isNaN(value) || !Number.isFinite(value) || !Number.isInteger(value)) {
      return { valid: false, error: `Field element is not in 'mod SNARK_SCALAR_FIELD': ${value}` };
    }

    try {
      value = BigInt(value);
    } catch (e) {
      return { valid: false, error: `Number field element cannot be converted to BigInt: ${value}` };
    }
  }

  if (value < 0n || value >= SNARK_SCALAR_FIELD) {
    return { valid: false, error: `Field element is not in 'mod SNARK_SCALAR_FIELD': ${value}` };
  }

  return { valid: true };
}