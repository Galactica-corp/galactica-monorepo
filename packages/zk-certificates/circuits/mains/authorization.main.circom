pragma circom 2.2.2;

include "../authorization.circom";

component main {public[userAddress]} = Authorization();