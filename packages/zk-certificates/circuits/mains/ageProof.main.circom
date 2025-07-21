pragma circom 2.2.2;

include "../ageProof.circom";

component main {public [currentYear, currentMonth, currentDay, ageThreshold]} = AgeProof();