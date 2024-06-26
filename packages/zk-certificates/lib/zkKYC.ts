/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import {
  zkKYCContentFields,
  zkKYCOptionalContent,
} from '@galactica-net/galactica-types';
import type { Eddsa } from 'circomlibjs';

import { hashStringToFieldNumber } from './helpers';

/**
 * Function preparing the inputs for a zkKYC certificate.
 * It hashes all string fields to be representable in zk circuits.
 * @param eddsa - Eddsa object from circomlibjs.
 * @param kycData - Input KYC data to be verified and hashed if necessary.
 * @returns Prepared KYC data.
 * @throws Error if any of the required fields is missing.
 */
export function prepareKYCFields(
  eddsa: Eddsa,
  kycData: any,
): Record<string, any> {
  // verify that all the fields are present
  const exceptions = ['holderCommitment'];
  const stringFieldsForHashing = [
    // TODO: standardize the definition of fields and which of those are hashed and read it from the standard instead of hardcoding it here
    'surname',
    'forename',
    'middlename',
    'streetAndNumber',
    'postcode',
    'town',
    'region',
    'country',
    'citizenship',
  ];
  const zkKYCFields: Record<string, any> = {};
  for (const field of zkKYCContentFields.filter(
    (content) => !exceptions.includes(content),
  )) {
    if (kycData[field] === undefined) {
      if (zkKYCOptionalContent.includes(field)) {
        kycData[field] = '';
      } else {
        throw new Error(`Field ${field} missing in KYC data`);
      }
    }
    if (stringFieldsForHashing.includes(field)) {
      // hashing string data so that it fits into the field used by the circuit
      zkKYCFields[field] = hashStringToFieldNumber(
        kycData[field],
        eddsa.poseidon,
      );
    } else {
      zkKYCFields[field] = kycData[field];
    }
  }

  return zkKYCFields;
}
