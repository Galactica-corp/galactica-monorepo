/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { HumanIDProofInput } from '@galactica-net/galactica-types';
import {
  humanIDFieldOrder,
  personIDFieldOrder,
  getContentSchema,
  KnownZkCertStandard,
} from '@galactica-net/galactica-types';

import type { ZkCertificate } from './zkCertificate';
import { prepareContentForCircuit } from './zkCertificateDataProcessing';

/**
 * Calculate dApp specific human ID from zkKYC and dApp address.
 * @param zkKYC - The zkCertificate containing the KYC data.
 * @param dAppAddress - Address of the dApp.
 * @returns Human ID as string.
 */
export function getHumanID(zkKYC: ZkCertificate, dAppAddress: string): string {
  if (zkKYC.zkCertStandard !== KnownZkCertStandard.ZkKYC) {
    throw new Error('zkKYC: can not get human ID from non-ZkKYC certificate');
  }

  return zkKYC.poseidon.F.toObject(
    zkKYC.poseidon(
      // fill needed fields from zkKYC with dAppAddress added at the correct place
      humanIDFieldOrder.map((field) =>
        field === 'dAppAddress'
          ? dAppAddress
          : (zkKYC.content as Record<string, any>)[field],
      ),
      undefined,
      1,
    ),
  ).toString();
}

/**
 * Get the ZKP input for the human ID proof.
 * @param dAppAddress - Address of the dApp.
 * @returns Human ID proof input.
 */
export function getHumanIDProofInput(dAppAddress: string): HumanIDProofInput {
  return {
    dAppAddress,
  };
}

/**
 * Calculate the user identifying hash as it is needed to register a salt in the salt registry.
 * @param zkKYC - The zkCertificate containing the KYC data.
 * @returns ZkKYC ID hash.
 */
export function getIdHash(zkKYC: ZkCertificate): string {
  if (zkKYC.zkCertStandard !== KnownZkCertStandard.ZkKYC) {
    throw new Error('zkKYC: can not get IdHash from non-ZkKYC certificate');
  }

  const content = prepareContentForCircuit(
    zkKYC.eddsa,
    zkKYC.content,
    getContentSchema(KnownZkCertStandard.ZkKYC),
  );

  return zkKYC.poseidon.F.toObject(
    zkKYC.poseidon(
      // fill needed fields from zkKYC with dAppAddress added at the correct place
      personIDFieldOrder.map(
        (field) => (content as Record<string, any>)[field],
      ),
      undefined,
      1,
    ),
  ).toString();
}
