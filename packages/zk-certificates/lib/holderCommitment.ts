/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { HolderCommitmentData } from '@galactica-net/galactica-types';

/**
 * Function checking the holderCommitment Input for consistency.
 * @param holderCommitmentData - Input data to be check if has everything a holderCommitment needs.
 * @returns Checked holderCommitment.
 * @throws Error if any of the required fields is missing
 */
export function parseHolderCommitment(
  holderCommitmentData: any,
): HolderCommitmentData {
  // verify that all the fields are present
  if (!holderCommitmentData.holderCommitment) {
    throw new Error(`Field holderCommitment missing in holderCommitment data`);
  }
  if (!holderCommitmentData.encryptionPubKey) {
    throw new Error(`Field encryptionPubKey missing in holderCommitment data`);
  }
  return {
    holderCommitment: holderCommitmentData.holderCommitment,
    encryptionPubKey: holderCommitmentData.encryptionPubKey,
  };
}
