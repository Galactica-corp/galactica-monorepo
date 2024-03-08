/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ZkCertStandard, zkKYCContentFields, twitterZkCertificateContentFields } from '@galactica-net/galactica-types';
import type { Eddsa } from 'circomlibjs';

import { hashStringToFieldNumber } from './helpers';

/**
 * Function preparing the inputs for a zkKYC certificate.
 * It hashes all string fields to be representable in zk circuits.
 * @param eddsa - Eddsa object from circomlibjs.
 * @param kycData - Input KYC data to be verified and hashed if necessary.
 * @param zkCertificateType - Type of ZkCert, default to be zkKYC.
 * @returns Prepared KYC data.
 * @throws Error if any of the required fields is missing.
 */
export function prepareZkCertificateFields(
  eddsa: Eddsa,
  zkCertificateData: any,
  zkCertificateType: ZkCertStandard = ZkCertStandard.ZkKYC
): Record<string, any> {
  // verify that all the fields are present
  const exceptions = ['holderCommitment'];
  let stringFieldsForHashing;
  let zkCertificateContentFields;
  if (zkCertificateType == ZkCertStandard.ZkKYC) {
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
      'passportID',
    ];
    zkCertificateContentFields = zkKYCContentFields;
  } else if (zkCertificateType == ZkCertStandard.TwitterZkCertificate) {
    stringFieldsForHashing = [
      'location'
    ];
    zkCertificateContentFields = twitterZkCertificateContentFields;
  }

  const zkCertificateFields: Record<string, any> = {};
  for (const field of zkCertificateContentFields.filter(
    (content) => !exceptions.includes(content),
  )) {
    if (zkCertificateData[field] === undefined) {
      throw new Error(`Field ${field} missing in zkCertificate data of type ${zkCertificateType}`);
    }
    if (stringFieldsForHashing.includes(field)) {
      // hashing string data so that it fits into the field used by the circuit
      zkCertificateFields[field] = hashStringToFieldNumber(
        zkCertificateData[field],
        eddsa.poseidon,
      );
    } else {
      zkCertificateFields[field] = zkCertificateData[field];
    }
  }
  return zkCertificateFields;
}
