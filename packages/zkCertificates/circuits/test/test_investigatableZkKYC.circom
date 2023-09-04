pragma circom 2.1.4;

include "../zkKYC.circom";

component main {public [
  root, 
  currentTime, 
  userAddress, 
  investigationInstitutionPubKey, 
  humanID, 
  dAppAddress,
  providerAx,
  providerAy
]} = ZKKYC(32, 60, 2, 3);