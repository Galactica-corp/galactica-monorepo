/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import {
  ZkCertStandard,
  zkKYCContentFields,
  twitterZkCertificateContentFields,
  reyZkCertificateContentFields,
} from '@galactica-net/galactica-types';
import type { Eddsa } from 'circomlibjs';

import { hashStringToFieldNumber } from './helpers';

/**
 * Function preparing the fields for  ZkCertificate depending on its types.
 * It hashes all string fields to be representable in zk circuits.
 * @param eddsa - Eddsa object from circomlibjs.
 * @param zkCertificateData - Input KYC data to be verified and hashed if necessary.
 * @param zkCertificateType - Type of ZkCert, default to be zkKYC.
 * @returns Prepared ZkCertificate data.
 * @throws Error if any of the required fields is missing.
 */
export function prepareZkCertificateFields(
  eddsa: Eddsa,
  zkCertificateData: any,
  zkCertificateType: ZkCertStandard = ZkCertStandard.ZkKYC,
): Record<string, any> {
  // verify that all the fields are present
  const exceptions = ['holderCommitment'];
  let stringFieldsForHashing: string[] = [];
  let dateFields: string[] = [];
  let zkCertificateContentFields: string[] = [];
  if (zkCertificateType === ZkCertStandard.ZkKYC) {
    stringFieldsForHashing = [
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
    zkCertificateContentFields = zkKYCContentFields;
  } else if (zkCertificateType === ZkCertStandard.Twitter) {
    stringFieldsForHashing = ['username'];
    zkCertificateContentFields = twitterZkCertificateContentFields;
    dateFields = ['createdAt'];
  } else if (zkCertificateType === ZkCertStandard.Rey) {
    stringFieldsForHashing = ['x_username'];
    zkCertificateContentFields = reyZkCertificateContentFields;
  } else if (zkCertificateType === ZkCertStandard.ArbitraryData) {
    zkCertificateContentFields = Object.keys(zkCertificateData);
  }

  const zkCertificateFields: Record<string, any> = {};
  for (const field of zkCertificateContentFields.filter(
    (content) => !exceptions.includes(content),
  )) {
    if (zkCertificateData[field] === undefined) {
      throw new Error(
        `Field ${field} missing in zkCertificate data of type ${zkCertificateType}`,
      );
    }
    if (stringFieldsForHashing.includes(field)) {
      // hashing string data so that it fits into the field used by the circuit
      zkCertificateFields[field] = hashStringToFieldNumber(
        zkCertificateData[field],
        eddsa.poseidon,
      );
    } else if (dateFields.includes(field)) {
      zkCertificateFields[field] = dateStringToUnixTimestamp(
        zkCertificateData[field],
      );
    } else {
      zkCertificateFields[field] = zkCertificateData[field];
    }
  }
  return zkCertificateFields;
}

export function dateStringToUnixTimestamp(date: string): number {
  // check if the date is given as RFC3339 string
  if (date.includes('T')) {
    return Math.floor(new Date(date).getTime() / 1000);
  }
  // check if the date is given as unix timestamp
  if (date.length === 10 && !isNaN(parseInt(date))) {
    return parseInt(date);
  }
  throw new Error(`Invalid date format (neither RFC3339 nor unix timestamp): ${date}`);
}
