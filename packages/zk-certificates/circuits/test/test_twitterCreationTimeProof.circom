pragma circom 2.1.4;

include "../twitterFollowersCountProof.circom";

component main {public [
  root,
  currentTime,
  userAddress,
  providerAx,
  providerAy,
  creationTimeLowerBound,
  creationTimeUpperBound
]} = TwitterFollowersCountProof(32, 60);
