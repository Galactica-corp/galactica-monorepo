pragma circom 2.1.4;

include "../ageCitizenshipKYC.circom";

// for the example mock DApp, we use a zkKYC proof
// together with age >= 18 and investigation instituttions
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
]} = AgeCitizenshipKYC(32, 60, 2, 3, 0);