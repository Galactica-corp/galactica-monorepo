import proverData from '../../site/public/provers/ageProofZkKYC.json';
import { HolderData, RpcArgs } from '../src/types';

export const defaultRPCRequest: RpcArgs = {
  origin: 'http://localhost:8000',
  request: {
    id: 'test-id',
    jsonrpc: '2.0',
    method: 'defaultTest',
  },
};

export const testSeedPhrase =
  'host void flip concert spare few spin advice nuclear age cigar collect';

export const testAddress = '0x53e173c619756eb6256d3ff4c7861bea5d739da1';
export const testSigForEdDSA =
  '0xeb730da4d936b1a99b6c899699a808d5e5d59be05dc1e9d124d5533f1629a049371e4262c9c69590c65c7215598b1736a3be0711fb234502c5dd908c445f37831b';

// eslint-disable-next-line max-len
export const testEdDSAKey =
  '0xeb730da4d936b1a99b6c899699a808d5e5d59be05dc1e9d124d5533f1629a049371e4262c9c69590c65c7215598b1736a3be0711fb234502c5dd908c445f37831b';
export const testHodlerCommitment =
  '2548540024400520720751029171633903682525672775622781811599241942877782733224';

export const testHolder: HolderData = {
  address: testAddress,
  holderCommitment: testHodlerCommitment,
  eddsaKey: testEdDSAKey,
};

export const testZkpParams = {
  input: {
    currentTime: 1676033833,
    currentYear: '2023',
    currentMonth: '2',
    currentDay: '10',
    ageThreshold: '18',
  },
  requirements: {
    zkCertStandard: 'gip69',
  },
  wasm: proverData.wasm,
  zkeyHeader: proverData.zkeyHeader,
  zkeySections: proverData.zkeySections,
};
