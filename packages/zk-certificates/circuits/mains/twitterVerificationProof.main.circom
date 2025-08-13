pragma circom 2.2.2;

include "../twitterVerificationProof.circom";

component main {public [
  root,
  currentTime,
  userAddress,
  providerAx,
  providerAy
]} = TwitterVerificationProof(32, 60);
