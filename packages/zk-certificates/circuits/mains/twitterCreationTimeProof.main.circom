pragma circom 2.2.2;

include "../twitterCreationTimeProof.circom";

component main {public [
  root,
  currentTime,
  userAddress,
  providerAx,
  providerAy,
  creationTimeLowerBound,
  creationTimeUpperBound
]} = TwitterCreationTimeProof(32, 60);
