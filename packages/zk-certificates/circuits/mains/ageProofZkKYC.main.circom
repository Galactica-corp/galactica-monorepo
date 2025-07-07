pragma circom 2.2.2;

include "../ageProofZkKYC.circom";

component main {public [
  root,
  currentTime, 
  userAddress, 
  currentYear, 
  currentMonth, 
  currentDay, 
  ageThreshold, 
  investigationInstitutionPubKey, 
  dAppAddress,
  providerAx,
  providerAy
]} = AgeProofZkKYC(32, 60, 0, 0);