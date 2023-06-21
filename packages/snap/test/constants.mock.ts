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

export const testEdDSAKey =
'0xba5bc6bbb3c34947f652b6abc403d350713bbaab6bb6f90d252cfae6466d97e0';
export const testHolderCommitment =
'21299951605992408668949924562963568070883824906758011123350028140304929514899';
export const testEntropy = '0x1234567889abcdef';

export const testHolder: HolderData = {
  holderCommitment: testHolderCommitment,
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
