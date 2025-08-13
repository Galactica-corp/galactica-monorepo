pragma circom 2.2.2;

include "../twitterZkCertificate.circom";

component main {public [
  root,
  currentTime,
  userAddress,
  providerAx,
  providerAy
]} = TwitterZkCertificate(32, 60);
