/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
pragma circom 2.1.4;

/*
    Polynomial with k coefficients (degree k-1) computing n points.
    For each x, it computes y = Sum(coef[i] * x^i)

    Parameters:
    k: number of coefficients
    n: number of points to calculate
*/
template Polynomial(k, n) {
    signal input coef[k];
    signal input x[n];
    signal output y[n];

    // Calculate the polynomial by adding up terms
    // We can reduce the number of multiplication by a factor of 2 if we calculate the polynomial from the other side,
    // i.e. f(x) = a_0 + a_1x + a_2x^2 + a_3x^3 = a_0 + x(a_1 + x(a_2 + xa_3))
    signal summingUp[n][k+1];
    for (var pointIndex = 0; pointIndex < n; pointIndex++) {
        summingUp[pointIndex][0] <== coef[k-1];
        for (var i = 1; i < k; i++) {
            summingUp[pointIndex][i] <== summingUp[pointIndex][i-1] * x[pointIndex] + coef[k-i-1];
        }
        y[pointIndex] <== summingUp[pointIndex][k-1];
    }
}
