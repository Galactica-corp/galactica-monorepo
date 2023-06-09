import proverData from '../../galactica-dapp/public/provers/ageProofZkKYC.json';
import {
  GenZkKycRequestParams,
  HolderData,
  RpcArgs,
  ZkKYCAgeProofInput,
  ProverData,
} from '../src/types';

const prover = proverData as ProverData;

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
export const testEntropy = '0x1234567889abcdef';

export const testHolder: HolderData = {
  holderCommitment: testHodlerCommitment,
  eddsaKey: testEdDSAKey,
};

export const testZkpParams: GenZkKycRequestParams<ZkKYCAgeProofInput> = {
  input: {
    // most values do not matter because they are checked on-chain only
    currentTime: 1676033833,
    currentYear: '2023',
    currentMonth: '2',
    currentDay: '10',
    ageThreshold: '18',
    investigationInstitutionPubKey: ['1', '2'],
    dAppAddress: '0x80c8C09868E97CF789e10666Ad10dD96639aCB6e',
  },
  requirements: {
    zkCertStandard: 'gip69',
  },
  wasm: prover.wasm,
  zkeyHeader: prover.zkeyHeader,
  zkeySections: prover.zkeySections,
  userAddress: testAddress,
};
