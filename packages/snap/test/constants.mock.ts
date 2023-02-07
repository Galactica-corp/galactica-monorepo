import { RpcArgs } from "../src/types";

export const defaultRPCRequest: RpcArgs = {
  origin: 'localhost',
  request: {
    id: 'test-id',
    jsonrpc: '2.0',
    method: 'defaultTest',
    params: {},
  },
};

export const testSeedPhrase =
  "host void flip concert spare few spin advice nuclear age cigar collect";

export const testAddress = "14A09a2b99F0FcDf6f8F9Bac8D69F0faC7C995c7";

// eslint-disable-next-line max-len
export const testPrivateKey =
  "48c9deca0df52efc9e7376306487e4fe86761981408b22f882ecd1b012d69a67";
