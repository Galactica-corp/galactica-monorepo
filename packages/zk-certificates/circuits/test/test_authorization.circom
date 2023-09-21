pragma circom 2.1.4;

include "../authorization.circom";

component main {public[userAddress]} = Authorization();