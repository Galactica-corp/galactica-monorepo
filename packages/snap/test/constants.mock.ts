import { ZkCertStandard } from '@galactica-net/galactica-types';
import type {
  GenZkProofParams,
  ProverData,
  ZkKYCAgeProofInput,
} from '@galactica-net/snap-api';
import { getEddsaKeyFromEntropy } from '@galactica-net/zk-certificates';
import { getEncryptionPublicKey } from '@metamask/eth-sig-util';
import hash from 'object-hash';

import proverData from '../../galactica-dapp/public/provers/exampleMockDApp.json';
import type { RpcArgs } from '../src/types';

// Tell JSON how to serialize BigInts
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

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

export const testHolderCommitment =
  '7735727246471767370788268218008649659345393646775019247808120566463753454903';
export const testEntropyHolder =
  '0xba5bc6bbb3c34947f652b6abc403d350713bbaab6bb6f90d252cfae6466d97e0';
export const testEdDSAKey = getEddsaKeyFromEntropy(testEntropyHolder);
export const testEntropyEncrypt =
  '0x06f095a41e4192bde91ed47f9b03286f2282f5416967aaa5d9b02fb85c5b1c1a';

export const testHolder = {
  holderCommitment: testHolderCommitment,
  eddsaEntropy: testEdDSAKey.toString('hex'),
  encryptionPrivKey: testEntropyEncrypt.slice(2),
  encryptionPubKey: getEncryptionPublicKey(testEntropyEncrypt.slice(2)),
};

export const testZkpParams: GenZkProofParams<ZkKYCAgeProofInput> = {
  input: {
    // most values do not matter because they are checked on-chain only
    currentTime: 1676033833,
    currentYear: '2023',
    currentMonth: '2',
    currentDay: '10',
    ageThreshold: '18',
    investigationInstitutionPubKey: [
      ['1', '2'],
      ['2', '3'],
      ['4', '5'],
    ],
    dAppAddress: '0x80c8C09868E97CF789e10666Ad10dD96639aCB6e',
  },
  requirements: {
    zkCertStandard: ZkCertStandard.ZkKYC,
    registryAddress: '0xD95efF72F06079DEcE33b18B165fc3A7a4bdc1fD',
  },
  prover,
  userAddress: testAddress,
  description: 'zkKYC check + age >= 18 check',
  publicInputDescriptions: [
    'human id',
    'user pubkey Ax',
    'user pubkey Ay',
    'proof valid',
    'verification SBT expiration',
    'encrypted fraud investigation shard institution 1',
    'encrypted fraud investigation shard institution 1',
    'encrypted fraud investigation shard institution 2',
    'encrypted fraud investigation shard institution 2',
    'encrypted fraud investigation shard institution 3',
    'encrypted fraud investigation shard institution 3',
    'merkle root',
    'current time',
    'user address',
    'current year',
    'current month',
    'current day',
    'age threshold',
    'dapp address',
    'zkKYC guardian pubkey Ax',
    'zkKYC guardian pubkey Ay',
    'institution 1 pubkey Ax',
    'institution 1 pubkey Ay',
    'institution 2 pubkey Ax',
    'institution 2 pubkey Ay',
    'institution 3 pubkey Ax',
    'institution 3 pubkey Ay',
  ],
  zkInputRequiresPrivKey: true,
};

export const merkleProofServiceURL =
  'https://merkle-proof-service.galactica.com/v1/galactica/';

export const testProverURL =
  'https://prover.galactica.com/v1/galactica/exampleMockDApp/';
export const proverHash = hash.MD5(testZkpParams.prover);
