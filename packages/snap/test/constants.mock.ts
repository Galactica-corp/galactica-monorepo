import {
  getContentSchema,
  KnownZkCertStandard,
} from '@galactica-net/galactica-types';
import type {
  GenZkProofParams,
  ProverData,
  BenchmarkZKPGenParams,
  ZkKYCAgeCitizenshipProofInput,
} from '@galactica-net/snap-api';
import { getEddsaKeyFromEntropy } from '@galactica-net/zk-certificates';
import { getEncryptionPublicKey } from '@metamask/eth-sig-util';
import { MD5 } from 'object-hash';

import zkCert from '../../../test/zkCert.json';
import zkCert2 from '../../../test/zkCert2.json';
import proverData from '../../galactica-dapp/public/provers/exampleMockDApp.json';
import exclusionProver from '../../galactica-dapp/public/provers/exclusion3.json';
import exclusionInput from '../../zk-certificates/circuits/input/exclusion3.json';
import type { RpcArgs, ZkCertStorage } from '../src/types';

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
export const testZkpParams: GenZkProofParams<ZkKYCAgeCitizenshipProofInput> = {
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
    countryExclusionList: [],
  },
  requirements: {
    zkCertStandard: KnownZkCertStandard.ZkKYC,
    registryAddress: '0xa922eE97D068fd95d5692c357698F6Bf2C6fd8cE',
  },
  prover,
  userAddress: testAddress,
  description: 'zkKYC check + age >= 18 check',
  publicInputDescriptions: [
    'human id',
    'user pubkey Ax',
    'user pubkey Ay',
    'proof valid',
    'error code',
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

export const benchmarkZKPGenParams: BenchmarkZKPGenParams = {
  input: exclusionInput,
  prover: exclusionProver as ProverData,
};

export const merkleProofServiceURL =
  'https://merkle-proof-service.galactica.com/v1/galactica/';

export const testProverURL =
  'https://prover.galactica.com/v1/galactica/exampleMockDApp/';
export const proverHash = MD5(testZkpParams.prover);

export const zkCertStorage: ZkCertStorage = {
  zkCert,
  schema: getContentSchema(KnownZkCertStandard.ZkKYC),
};

export const zkCertStorage2: ZkCertStorage = {
  zkCert: zkCert2,
  schema: getContentSchema(KnownZkCertStandard.ZkKYC),
};
