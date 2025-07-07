pragma circom 2.2.2;

include "../twitterFollowersCountProof.circom";

component main {public [
  root,
  currentTime,
  userAddress,
  providerAx,
  providerAy,
  followersCountThreshold
]} = TwitterFollowersCountProof(32, 60);
