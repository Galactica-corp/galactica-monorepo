/* Copyright (C) 2024 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

pragma circom 2.1.4;

include "../../../node_modules/circomlib/circuits/comparators.circom";


/**
 * Circuit checks that a string hash is in a list of hashes.
 * @param listSize - The size of the inclusion list.
 */
template Inclusion(listSize){
    signal input value;
    signal input list[listSize];

    // final result
    signal output valid;

    component equal = IsEqual();
    equal.in[0] <== value;
    equal.in[1] <== list[0];
    valid <== equal.out;
    // TODO: Implement iteration check
    // This could be made more efficient by searching in a sorted list. Might be worth it if the list is large.
}

/**
 * Circuit checks that a string hash is not in a list of excluded hashes, for example a country sanction list.
 * @param listSize - The size of the exclusion list.
 */
template Exclusion(listSize){
    // age info from 
    signal input value;
    signal input list[listSize];

    // final result
    signal output valid;

    component inclusion = Inclusion(listSize);
    inclusion.value <== value;
    for (var i = 0; i < listSize; i++){
        inclusion.list[i] <== list[i];
    }
    valid <== 1 - inclusion.valid;
}