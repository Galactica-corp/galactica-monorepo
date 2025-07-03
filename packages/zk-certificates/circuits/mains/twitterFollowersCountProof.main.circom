pragma circom 2.1.4;

include "../twitterFollowersCountProof.circom";

component main {public [
  root,
  currentTime,
  userAddress,
  providerAx,
  providerAy,
  followersCountThreshold
]} = TwitterFollowersCountProof(32, 60);
