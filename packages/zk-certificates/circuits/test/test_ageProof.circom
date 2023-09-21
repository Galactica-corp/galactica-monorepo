pragma circom 2.1.4;

include "../ageProof.circom";

component main {public [currentYear, currentMonth, currentDay, ageThreshold]} = AgeProof();