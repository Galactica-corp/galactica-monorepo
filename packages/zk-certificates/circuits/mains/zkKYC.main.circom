pragma circom 2.2.2;

include "../zkKYC.circom";

component main {public [
  root, 
  currentTime, 
  userAddress, 
  investigationInstitutionPubKey, 
  dAppAddress,
  providerAx,
  providerAy
]} = ZKKYC(32, 60, 0, 0);