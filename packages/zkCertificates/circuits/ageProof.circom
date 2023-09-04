/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

pragma circom 2.1.4;

include "../node_modules/circomlib/circuits/comparators.circom";

/*
Circuit checks that user corresponding to certain zkKYC record has reached age threshold
*/
template AgeProof(){
    // age info from 
    signal input yearOfBirth;
    signal input monthOfBirth;
    signal input dayOfBirth;

    // public time inputs
    signal input currentYear;
    signal input currentMonth;
    signal input currentDay;

    // age threshold
    signal input ageThreshold;

    // final result
    signal output valid;

    // check that user is older than the age threshold
    var combinedBirthInfo = yearOfBirth * 10000 + monthOfBirth * 100 + dayOfBirth;
    var combinedCurrentDate = currentYear * 10000 + currentMonth * 100 + currentDay;
    component compare = GreaterEqThan(128);
    compare.in[0] <== combinedCurrentDate;
    compare.in[1] <== combinedBirthInfo + ageThreshold * 10000;
    valid <== compare.out;
}