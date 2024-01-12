pragma circom 2.1.4;

include "../patriciaTree.circom";

component main {public [
  rootHashHexs
] } = MPTInclusionFixedKeyHexLen(
  10, // maxDepth: same as in zk-attestor
  64, // keyHexLen: 1 for each 4 bits in an ethereum address
  228 // maxValueHexLen: same as in zk-attestor
);