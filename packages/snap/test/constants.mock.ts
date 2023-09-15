import { ZkCertStandard } from '@galactica-net/galactica-types';
import {
  GenZkProofParams,
  ProverData,
  ZkKYCAgeProofInput,
} from '@galactica-net/snap-api';
import { getEncryptionPublicKey } from '@metamask/eth-sig-util';

import proverData from '../../galactica-dapp/public/provers/exampleMockDApp.json';
import { HolderData, RpcArgs } from '../src/types';

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

export const testEdDSAKey =
  '0xba5bc6bbb3c34947f652b6abc403d350713bbaab6bb6f90d252cfae6466d97e0';
export const testHolderCommitment =
  '21299951605992408668949924562963568070883824906758011123350028140304929514899';
export const testEntropyHolder =
  '0xb20856fb82e1cecef698e0bdb837bdb7bd1ac8a03cceeaca9d404e7a29ca2fc6';
export const testEntropyEncrypt =
  '0x06f095a41e4192bde91ed47f9b03286f2282f5416967aaa5d9b02fb85c5b1c1a';

export const testHolder: HolderData = {
  holderCommitment: testHolderCommitment,
  eddsaKey: testEdDSAKey,
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
    registryAddress: '0xAbb654092b5BCaeca2E854550c5C972602eF7dA8',
  },
  prover,
  userAddress: testAddress,
};
