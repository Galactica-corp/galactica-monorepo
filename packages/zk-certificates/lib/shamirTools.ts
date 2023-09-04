/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

/**
 * Reconstruct a secret from Shamir's secret sharing.
 * All shares must be in decrypted form.
 * 
 * @param field The finite field to use.
 * @param k The minimum number of shares required to reconstruct the secret (defines degree of polynomial).
 * @param shares Shares of the participants to reconstruct the secret. Each is a 2-tuple containing the share index =x and the value =y.
 * @returns The reconstructed secret as stringified field element.
 */
export function reconstructShamirSecret(field: any, k: number, shares: [number, string][]): string {
    if (shares.length < k) {
        throw new Error('Not enough shares to reconstruct secret');
    }
    // if more than k shares are provided, only the first k are used

    // Check for duplicated indices
    const shareIndices = new Set(shares.map(share => share[0]));
    if (shareIndices.size < shares.length) {
        throw new Error('Share inputs need to be unique');
    }

    // Using the interpolation formula from https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing#Mathematical_formulation
    let sum = field.e(0);
    for (let j = 0; j < k; j++) {
        let product = field.e(1);
        for (let m = 0; m < k; m++) {
            if (m == j) continue;
            product = field.mul(
                product,
                field.div(
                    field.e(shares[m][0]),
                    field.sub(
                        field.e(shares[m][0]),
                        field.e(shares[j][0])
                    )
                )
            );
        }
        sum = field.add(sum, field.mul(field.e(shares[j][1]), product));
    }
    return field.toObject(sum).toString();
}
