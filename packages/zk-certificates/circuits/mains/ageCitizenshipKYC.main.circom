pragma circom 2.2.2;

include "../ageCitizenshipKYC.circom";

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
  providerAy,
  countryExclusionList
]} = AgeCitizenshipKYC(32, 60, 0, 0, 20);