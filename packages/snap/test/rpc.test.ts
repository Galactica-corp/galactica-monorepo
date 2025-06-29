import type { HolderCommitmentData } from '@galactica-net/galactica-types';
import type {
  ConfirmationResponse,
  EncryptedZkCert,
  MerkleProof,
  MerkleProofUpdateRequestParams,
  ZkCertProof,
  ZkCertRegistered,
  ZkCertSelectionParams,
  ProverData,
} from '@galactica-net/snap-api';
import {
  RpcMethods,
  RpcResponseErr,
  RpcResponseMsg,
  ZkCertStandard,
} from '@galactica-net/snap-api';
import type { Poseidon } from '@galactica-net/zk-certificates';
import {
  fromDecToHex,
  getMerkleRootFromProof,
} from '@galactica-net/zk-certificates';
import { decryptSafely, getEncryptionPublicKey } from '@metamask/eth-sig-util';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiFetchMock from 'chai-fetch-mock';
import { buildPoseidon } from 'circomlibjs';
import fetchMock from 'fetch-mock';
import { match } from 'sinon';
import sinonChai from 'sinon-chai';
import { groth16 } from 'snarkjs';

import {
  benchmarkZKPGenParams,
  defaultRPCRequest,
  merkleProofServiceURL,
  proverHash,
  testEdDSAKey,
  testEntropyEncrypt,
  testEntropyHolder,
  testHolder,
  testProverURL,
  testZkpParams,
} from './constants.mock';
import { mockEthereumProvider, mockSnapProvider } from './wallet.mock';
import reyCert from '../../../test/reyCert.json';
import updatedMerkleProof from '../../../test/updatedMerkleProof.json';
import zkCert from '../../../test/zkCert.json';
import zkCert2 from '../../../test/zkCert2.json';
import exampleMockDAppVKey from '../../galactica-dapp/public/provers/exampleMockDApp.vkey.json';
import exclusion3VKey from '../../galactica-dapp/public/provers/exclusion3.vkey.json';
import { processRpcRequest } from '../src';
import { encryptZkCert } from '../src/encryption';
import {
  subPathWasm,
  subPathZkeyHeader,
  subPathZkeySections,
} from '../src/proofGenerator';
import type { RpcArgs } from '../src/types';
import { calculateHolderCommitment } from '../src/zkCertHandler';

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiFetchMock);

/**
 * Helper to build RPC requests for testing.
 * @param method - The method to be called.
 * @param params - Parameters to be passed, if any.
 * @returns The RPC request object.
 */
function buildRPCRequest(method: RpcMethods, params: any = undefined): RpcArgs {
  const res = defaultRPCRequest;
  res.request.method = method;
  if (params) {
    res.request.params = params;
  }
  return res;
}

/**
 * Verifies a proof and expects it to be valid.
 * @param result - The proof to be verified.
 * @param minPublicSignalsLength - The minimum length of the public signals.
 * @param vkey - The verification key to be used.
 */
async function verifyProof(
  result: ZkCertProof,
  minPublicSignalsLength = 5,
  vkey: any = exampleMockDAppVKey,
) {
  expect(result.proof.pi_a.length).to.be.eq(3);
  expect(result.proof.pi_b.length).to.be.eq(3);
  expect(result.proof.pi_c.length).to.be.eq(3);
  expect(result.publicSignals.length).to.be.gt(minPublicSignalsLength);

  const verification = await groth16.verify(
    vkey,
    result.publicSignals,
    result.proof,
  );
  expect(verification).to.be.true;
}

/**
 * Helper for formatting a merkle proof to the format expected by the service.
 * @param merkleProof - The merkle proof to be formatted.
 * @returns The formatted merkle proof as returned by the service.
 */
function merkleProofToServiceResponse(merkleProof: MerkleProof): any {
  return {
    proof: {
      index: merkleProof.leafIndex,
      path: merkleProof.pathElements,
    },
  };
}

describe('Test rpc handler function', function () {
  const snapProvider = mockSnapProvider();
  const ethereumProvider = mockEthereumProvider();
  let poseidon: Poseidon;

  before(async function () {
    // prepare URL to fetch provers from
    const prover = testZkpParams.prover as ProverData; // we know it is a prover
    fetchMock.get(testProverURL + subPathWasm, JSON.stringify(prover.wasm));
    fetchMock.get(
      testProverURL + subPathZkeyHeader,
      JSON.stringify({
        ...prover.zkeyHeader,
        sectionsLength: prover.zkeySections.length,
      }),
    );
    for (let i = 0; i < prover.zkeySections.length; i++) {
      fetchMock.get(
        testProverURL + subPathZkeySections(i),
        JSON.stringify(prover.zkeySections[i]),
      );
    }
    poseidon = await buildPoseidon();
  });

  beforeEach(function () {
    snapProvider.rpcStubs.snap_getEntropy
      .onFirstCall()
      .resolves(testEntropyHolder)
      .onSecondCall()
      .resolves(testEntropyEncrypt);
    ethereumProvider.rpcStubs.eth_chainId.resolves('41233');
    ethereumProvider.rpcStubs.eth_call.resolves(
      fromDecToHex(getMerkleRootFromProof(zkCert.merkleProof, poseidon), true),
    );

    // setting up merkle proof service for testing
    fetchMock.get(
      `${merkleProofServiceURL}${zkCert.registration.chainID.toString()}/merkle/proof/${
        zkCert.registration.address
      }/${zkCert.leafHash}`,
      merkleProofToServiceResponse(zkCert.merkleProof),
      { overwriteRoutes: true },
    );
    fetchMock.get(
      `${merkleProofServiceURL}${zkCert.registration.chainID.toString()}/merkle/proof/${
        zkCert2.registration.address
      }/${zkCert2.leafHash}`,
      merkleProofToServiceResponse(zkCert2.merkleProof),
      { overwriteRoutes: true },
    );
  });

  afterEach(function () {
    expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
      operation: 'get',
    });
    snapProvider.reset();
    ethereumProvider.reset();
    fetchMock.resetHistory();
  });

  describe('Clear Storage method', function () {
    /* eslint-disable jest/no-done-callback, no-invalid-this */
    // (found no better way to increase timeouts for async tests)
    it('should throw error if not confirmed', async function (this: Mocha.Context) {
      this.timeout(4000);
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ClearStorage),
        snapProvider,
        ethereumProvider,
      );
      await expect(callPromise).to.be.rejectedWith(
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should clear storage', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.ClearStorage),
        snapProvider,
        ethereumProvider,
      )) as ConfirmationResponse;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: { holders: [], zkCerts: [], merkleServiceURL: '' },
      });
      expect(result.message).to.be.eq(RpcResponseMsg.StorageCleared);
    });
  });

  describe('Get Holder Commitment method', function () {
    beforeEach(function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [
            {
              address: '0x1234',
              holderCommitment: '0x2345',
              eddsaEntropy:
                '0001020304050607080900010203040506070809000102030405060708090001',
              encryptionPrivKey: '0x1234',
              encryptionPubKey: '0x1234',
            },
          ],
          zkCerts: [],
        });
    });

    it('should throw error if not confirmed', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GetHolderCommitment),
        snapProvider,
        ethereumProvider,
      );
      await expect(callPromise).to.be.rejectedWith(
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should return holder commitment', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(true);

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.GetHolderCommitment),
        snapProvider,
        ethereumProvider,
      )) as HolderCommitmentData;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(result.holderCommitment).to.be.eq('0x2345');
    });
  });

  describe('Add Holder method', function () {
    it('should add holder successfully', async function (this: Mocha.Context) {
      this.timeout(5000);
      snapProvider.rpcStubs.snap_dialog.resolves(true);

      const expectedHolderCommitment =
        await calculateHolderCommitment(testEdDSAKey);
      const zkKYC = { ...zkCert };
      zkKYC.holderCommitment = expectedHolderCommitment;

      await processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, {
          encryptedZkCert: encryptZkCert(
            zkKYC as ZkCertRegistered,
            testHolder.encryptionPubKey,
            expectedHolderCommitment,
          ),
        }),
        snapProvider,
        ethereumProvider,
      );

      // even with no holder configured before, the snap should add the holder from the getEntropy method
      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [
            {
              eddsaEntropy: testEdDSAKey.toString('hex'),
              holderCommitment: expectedHolderCommitment,
              encryptionPrivKey: testEntropyEncrypt.slice(2),
              encryptionPubKey: getEncryptionPublicKey(
                testEntropyEncrypt.slice(2),
              ),
            },
          ],
          zkCerts: [zkKYC],
          merkleServiceURL: '',
        },
      });
    });
  });

  describe('Import zkCert method', function () {
    let encryptedZkCert: EncryptedZkCert;

    beforeEach(function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [],
        });

      encryptedZkCert = encryptZkCert(
        zkCert as ZkCertRegistered,
        testHolder.encryptionPubKey,
        zkCert.holderCommitment,
      );
    });

    it('should throw error if not confirmed', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, { encryptedZkCert }),
        snapProvider,
        ethereumProvider,
      );
      await expect(callPromise).to.be.rejectedWith(
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should throw if the zkCert is not encrypted', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, { zkCert }),
        snapProvider,
        ethereumProvider,
      );
      await expect(callPromise).to.be.rejectedWith(
        'not in the EthEncryptedData format',
      );
    });

    it('should throw if data is missing in zkCert', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const invalidZkCert: any = { ...zkCert };
      invalidZkCert.holderCommitment = undefined;

      const invalidEncryptedZkCert = encryptZkCert(
        invalidZkCert as ZkCertRegistered,
        testHolder.encryptionPubKey,
        zkCert.holderCommitment,
      );

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, {
          encryptedZkCert: invalidEncryptedZkCert,
        }),
        snapProvider,
        ethereumProvider,
      );
      await expect(callPromise).to.be.rejectedWith(
        'The decrypted zkCert is invalid. It is missing the filed holderCommitment.',
      );
    });

    it('should import zkCert successfully', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(true);

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, { encryptedZkCert }),
        snapProvider,
        ethereumProvider,
      )) as ConfirmationResponse;

      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [testHolder],
          zkCerts: [zkCert],
          merkleServiceURL: '',
        },
      });
      expect(result.message).to.be.eq(RpcResponseMsg.ZkCertImported);
    });

    it('should not import same zkCert again', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, { encryptedZkCert }),
        snapProvider,
        ethereumProvider,
      )) as ConfirmationResponse;

      expect(result.message).to.be.eq(RpcResponseMsg.ZkCertAlreadyImported);
      expect(
        snapProvider.rpcStubs.snap_manageState,
      ).to.not.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [testHolder],
          zkCerts: [zkCert, zkCert],
          merkleServiceURL: '',
        },
      });
    });

    it('should provide zkCert list after import according to flag', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [],
        });

      const res: any = await processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, {
          encryptedZkCert,
          listZkCerts: true,
        }),
        snapProvider,
        ethereumProvider,
      );

      expect(res).to.have.key(zkCert.zkCertStandard);
      expect(res[zkCert.zkCertStandard].length).to.equal(1);
      expect(
        res[zkCert.zkCertStandard][0].providerPubKey.ax,
        'testing providerPubKey.ax',
      ).to.equal(zkCert.providerData.ax);
      expect(
        res[zkCert.zkCertStandard][0].providerPubKey.ay,
        'testing providerPubKey.ay',
      ).to.equal(zkCert.providerData.ay);
      expect(
        res[zkCert.zkCertStandard][0].expirationDate,
        'testing expiration date of 0',
      ).to.equal(zkCert.expirationDate);
    });

    it('should update a zkCert if a renewed version is imported at the same position in the Merkle tree', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const renewedZkCert = JSON.parse(JSON.stringify(zkCert)); // deep copy to not mess up original
      // some made up content analog to a renewed zkCert
      renewedZkCert.expirationDate += 20;
      renewedZkCert.leafHash = zkCert2.leafHash;
      // note that the merkle path indices and registry address stay the same

      const encryptedRenewedZkCert = encryptZkCert(
        renewedZkCert as ZkCertRegistered,
        testHolder.encryptionPubKey,
        zkCert.holderCommitment,
      );

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, {
          encryptedZkCert: encryptedRenewedZkCert,
        }),
        snapProvider,
        ethereumProvider,
      )) as any;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledTwice; // once for the import, once for the update
      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [testHolder],
          zkCerts: [renewedZkCert],
          merkleServiceURL: '',
        },
      });
      expect(result.message).to.be.eq(RpcResponseMsg.ZkCertImported);
    });
  });

  describe('Generate ZKP method', function () {
    it('should throw error if not confirmed', async function (this: Mocha.Context) {
      this.timeout(25000);
      snapProvider.rpcStubs.snap_dialog.resolves(false);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkCertProof, testZkpParams),
        snapProvider,
        ethereumProvider,
      );
      await expect(callPromise).to.be.rejectedWith(
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should generate ZKP successfully', async function (this: Mocha.Context) {
      this.timeout(25000);

      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkCertProof, testZkpParams),
        snapProvider,
        ethereumProvider,
      )) as ZkCertProof;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(snapProvider.rpcStubs.snap_notify).to.have.been.calledOnce;
      // Merkle proof should be up to date and therefore not be fetched
      expect(fetchMock.calls()).to.be.empty;

      await verifyProof(result);
    });

    it('should be able to select from multiple zkCerts', async function (this: Mocha.Context) {
      this.timeout(25000);

      snapProvider.rpcStubs.snap_dialog
        .withArgs(match.has('type', 'confirmation'))
        .resolves(true);
      snapProvider.rpcStubs.snap_dialog
        .withArgs(match.has('type', 'prompt'))
        .resolves(1); // The text entered by the user
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert, zkCert2],
        });

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkCertProof, testZkpParams),
        snapProvider,
        ethereumProvider,
      )) as ZkCertProof;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledTwice;

      await verifyProof(result);
    });

    it('should reject when user refuses zkCert selection', async function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert, zkCert2],
        });
      snapProvider.rpcStubs.snap_dialog
        .withArgs(match.has('type', 'prompt'))
        .resolves(null); // user clicked reject or entered nothing before pressing accept

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkCertProof, testZkpParams),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedSelect,
      );

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
    });

    it('should repeat zkCert selection if user enters garbage', async function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert, zkCert2],
        });
      snapProvider.rpcStubs.snap_dialog
        .withArgs(match.has('type', 'prompt'))
        .onFirstCall()
        .resolves('garbage') // no valid number
        .onSecondCall()
        .resolves(10000000) // index out of bounds
        .onThirdCall()
        .resolves(null); // user clicked reject or entered nothing before pressing accept

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkCertProof, testZkpParams),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedSelect,
      );

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.callCount(3);
      expect(snapProvider.rpcStubs.snap_notify).to.have.been.calledTwice;
    });

    it('should handle failures fetching merkle proof update', async function (this: Mocha.Context) {
      this.timeout(25000);
      fetchMock.get(
        `${merkleProofServiceURL}${zkCert.registration.chainID.toString()}/merkle/proof/${
          zkCert.registration.address
        }/${zkCert.leafHash}`,
        404,
        { overwriteRoutes: true },
      );

      const outdatedZkCert = JSON.parse(JSON.stringify(zkCert)); // deep copy to not mess up original
      outdatedZkCert.merkleProof.pathElements[0] = '01234';
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [outdatedZkCert],
        });

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkCertProof, testZkpParams),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        'Merkle proof fetch failed with status 404: Not Found',
      );
      expect(fetchMock.calls().length).to.equal(1);
    });

    it('should automatically fetch new merkle proof from node', async function (this: Mocha.Context) {
      this.timeout(25000);
      snapProvider.rpcStubs.snap_dialog.resolves(true);

      const outdatedZkCert = JSON.parse(JSON.stringify(zkCert)); // deep copy to not mess up original
      outdatedZkCert.merkleProof.pathElements[0] = '01234';

      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [outdatedZkCert],
        });

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkCertProof, testZkpParams),
        snapProvider,
        ethereumProvider,
      )) as ZkCertProof;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(snapProvider.rpcStubs.snap_notify).to.have.been.calledOnce;

      await verifyProof(result);

      // Merkle proof should have been updated and stored
      expect(fetchMock.calls().length).to.equal(1);
      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [testHolder],
          zkCerts: [zkCert],
          merkleServiceURL: '',
        },
      });
    });

    it('should fetch large provers from a URL', async function (this: Mocha.Context) {
      this.timeout(25000);
      snapProvider.rpcStubs.snap_dialog.resolves(true);

      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const testParamsWithUrl = { ...testZkpParams };
      testParamsWithUrl.prover = {
        url: testProverURL,
        hash: proverHash,
      };

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkCertProof, testParamsWithUrl),
        snapProvider,
        ethereumProvider,
      )) as ZkCertProof;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(snapProvider.rpcStubs.snap_notify).to.have.been.calledOnce;

      await verifyProof(result);

      // Merkle proof should have been updated and stored
      expect(fetchMock.calls().length).to.equal(
        2 + (testZkpParams.prover as ProverData).zkeySections.length,
      );
    });

    it('should reject fetched provers with wrong hash', async function (this: Mocha.Context) {
      this.timeout(25000);

      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const testParamsWithUrl = { ...testZkpParams };
      testParamsWithUrl.prover = {
        url: testProverURL,
        hash: 'wrongHash',
      };

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkCertProof, testParamsWithUrl),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        'Prover data hash does not match hash in ProverLink.',
      );
      expect(fetchMock.calls().length).to.equal(
        2 + (testZkpParams.prover as ProverData).zkeySections.length,
      );
    });

    it('should handle failed prover fetch', async function (this: Mocha.Context) {
      this.timeout(25000);

      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const wrongURL = 'https://doesnotexistsdfjklaf.com/';
      fetchMock.get(wrongURL + subPathWasm, 404);

      const testParamsWithUrl = { ...testZkpParams };
      testParamsWithUrl.prover = {
        url: wrongURL,
        hash: 'wrongHash',
      };

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkCertProof, testParamsWithUrl),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        `Failed to fetch prover data from ${wrongURL + subPathWasm} .`,
      );
    });

    it('should handle unknown zkCert types', async function (this: Mocha.Context) {
      this.timeout(25000);

      const unknownZkCert = JSON.parse(JSON.stringify(zkCert));
      unknownZkCert.zkCertStandard = 'gipUKNOWN';
      const testUnkownZkpParams = { ...testZkpParams };
      testUnkownZkpParams.requirements = {
        ...testZkpParams.requirements,
        zkCertStandard: unknownZkCert.zkCertStandard,
      };

      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [unknownZkCert],
        });

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkCertProof, testUnkownZkpParams),
        snapProvider,
        ethereumProvider,
      )) as ZkCertProof;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(snapProvider.rpcStubs.snap_notify).to.have.been.calledOnce;
      // Merkle proof should be up to date and therefore not be fetched
      expect(fetchMock.calls()).to.be.empty;

      await verifyProof(result);
    });
  });

  describe('List zkCerts', function () {
    it('should throw error if not confirmed', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(false);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ListZkCerts, {}),
        snapProvider,
        ethereumProvider,
      );
      await expect(callPromise).to.be.rejectedWith(
        RpcResponseErr.RejectedConfirm,
      );
      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
    });

    it('should show imported zkCert selection', async function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert, zkCert2],
        });
      snapProvider.rpcStubs.snap_dialog
        .withArgs(match.has('type', 'confirmation'))
        .resolves(true);

      const res: any = await processRpcRequest(
        buildRPCRequest(RpcMethods.ListZkCerts),
        snapProvider,
        ethereumProvider,
      );

      expect(res).to.have.key(zkCert.zkCertStandard);
      expect(res[zkCert.zkCertStandard].length).to.equal(2);
      expect(
        res[zkCert.zkCertStandard][0].providerPubKey.ax,
        'testing providerPubKey.ax',
      ).to.equal(zkCert.providerData.ax);
      expect(
        res[zkCert.zkCertStandard][0].providerPubKey.ay,
        'testing providerPubKey.ay',
      ).to.equal(zkCert.providerData.ay);
      expect(
        res[zkCert.zkCertStandard][0].expirationDate,
        'testing expiration date of 0',
      ).to.equal(zkCert.expirationDate);
      expect(
        res[zkCert.zkCertStandard][1].expirationDate,
        'testing expiration date of 1',
      ).to.equal(zkCert2.expirationDate);
      expect(
        res[zkCert.zkCertStandard][1].verificationLevel,
        'testing verification level',
      ).to.equal(zkCert2.content.verificationLevel);
      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
    });

    it('should filter list according to parameters', async function () {
      const zkCert2OnOtherChain = JSON.parse(JSON.stringify(zkCert2));
      zkCert2OnOtherChain.registration.chainID = 12345;

      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert, zkCert2OnOtherChain],
        });
      snapProvider.rpcStubs.snap_dialog
        .withArgs(match.has('type', 'confirmation'))
        .resolves(true);

      // filter for chainId 12345 to get only one
      let res: any = await processRpcRequest(
        buildRPCRequest(RpcMethods.ListZkCerts, { chainID: 12345 }),
        snapProvider,
        ethereumProvider,
      );
      expect(res[zkCert.zkCertStandard].length).to.equal(1);

      // filter type to get both
      res = await processRpcRequest(
        buildRPCRequest(RpcMethods.ListZkCerts, {
          zkCertStandard: ZkCertStandard.ZkKYC,
        }),
        snapProvider,
        ethereumProvider,
      );
      expect(res[zkCert.zkCertStandard].length).to.equal(2);

      // filter for garbage to get none
      res = await processRpcRequest(
        buildRPCRequest(RpcMethods.ListZkCerts, { registryAddress: '0x00' }),
        snapProvider,
        ethereumProvider,
      );
      expect(res).to.not.have.key(zkCert.zkCertStandard);
    });

    it('should ignore case when filtering', async function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });
      snapProvider.rpcStubs.snap_dialog
        .withArgs(match.has('type', 'confirmation'))
        .resolves(true);

      // filter with address in mixed case
      let res: any = await processRpcRequest(
        buildRPCRequest(RpcMethods.ListZkCerts, {
          registryAddress: zkCert.registration.address,
        }),
        snapProvider,
        ethereumProvider,
      );
      expect(res[zkCert.zkCertStandard].length).to.equal(1);

      // filter with address in lower case
      res = await processRpcRequest(
        buildRPCRequest(RpcMethods.ListZkCerts, {
          registryAddress: zkCert.registration.address.toLowerCase(),
        }),
        snapProvider,
        ethereumProvider,
      );
      expect(res[zkCert.zkCertStandard].length).to.equal(1);
    });
  });

  describe('Get ZkCert Storage hash', function () {
    it('should stay the same if the storage is the same', async function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert, zkCert2],
        });

      const hashes0 = await processRpcRequest(
        buildRPCRequest(RpcMethods.GetZkCertStorageHashes),
        snapProvider,
        ethereumProvider,
      );
      const hashes1 = await processRpcRequest(
        buildRPCRequest(RpcMethods.GetZkCertStorageHashes),
        snapProvider,
        ethereumProvider,
      );

      expect(hashes0).to.have.key(zkCert.zkCertStandard);
      expect(hashes0).to.deep.equal(hashes1);
      expect(snapProvider.rpcStubs.snap_dialog).to.not.have.been.called;
    });

    it('should change when the storage changes', async function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .onFirstCall()
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        })
        .onSecondCall()
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert, zkCert2],
        });

      const hashes0 = await processRpcRequest(
        buildRPCRequest(RpcMethods.GetZkCertStorageHashes),
        snapProvider,
        ethereumProvider,
      );
      const hashes1 = await processRpcRequest(
        buildRPCRequest(RpcMethods.GetZkCertStorageHashes),
        snapProvider,
        ethereumProvider,
      );

      expect(hashes0).to.have.key(zkCert.zkCertStandard);
      expect(hashes1).to.have.key(zkCert.zkCertStandard);
      expect(hashes0).to.not.deep.equal(hashes1);
      expect(snapProvider.rpcStubs.snap_dialog).to.not.have.been.called;
    });

    it('should not change on updating the merkle proof', async function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });
      snapProvider.rpcStubs.snap_dialog.resolves(true);

      const hashes0 = await processRpcRequest(
        buildRPCRequest(RpcMethods.GetZkCertStorageHashes),
        snapProvider,
        ethereumProvider,
      );

      const updateParams: MerkleProofUpdateRequestParams = {
        updates: [
          {
            proof: updatedMerkleProof,
            registryAddr: zkCert.registration.address,
          },
        ],
      };

      await processRpcRequest(
        buildRPCRequest(RpcMethods.UpdateMerkleProof, updateParams),
        snapProvider,
        ethereumProvider,
      );

      const hashes1 = await processRpcRequest(
        buildRPCRequest(RpcMethods.GetZkCertStorageHashes),
        snapProvider,
        ethereumProvider,
      );

      expect(hashes0).to.have.key(zkCert.zkCertStandard);
      expect(hashes1).to.have.key(zkCert.zkCertStandard);
      expect(hashes0).to.deep.equal(hashes1);
    });
  });

  describe('Export zkCert', function () {
    it('should throw error if not confirmed', async function (this: Mocha.Context) {
      this.timeout(5000);
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const params: ZkCertSelectionParams = {
        zkCertStandard: ZkCertStandard.ZkKYC,
      };

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ClearStorage, params),
        snapProvider,
        ethereumProvider,
      );
      await expect(callPromise).to.be.rejectedWith(
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should provide zkCert on approval', async function (this: Mocha.Context) {
      this.timeout(5000);
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const params: ZkCertSelectionParams = {
        zkCertStandard: ZkCertStandard.ZkKYC,
      };

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.ExportZkCert, params),
        snapProvider,
        ethereumProvider,
      )) as EncryptedZkCert;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(result.holderCommitment).to.be.eq(testHolder.holderCommitment);

      const decrypted = decryptSafely({
        encryptedData: result,
        privateKey: testHolder.encryptionPrivKey,
      });
      expect(decrypted).to.be.deep.eq(zkCert);
    });

    it('should handle unknown certificate types', async function (this: Mocha.Context) {
      this.timeout(5000);

      const unknownZkCert = JSON.parse(JSON.stringify(reyCert));
      unknownZkCert.zkCertStandard = 'gip123456789';

      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [unknownZkCert],
        });

      const params: ZkCertSelectionParams = {
        zkCertStandard: unknownZkCert.zkCertStandard,
      };

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.ExportZkCert, params),
        snapProvider,
        ethereumProvider,
      )) as EncryptedZkCert;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(result.holderCommitment).to.be.eq(testHolder.holderCommitment);

      const decrypted = decryptSafely({
        encryptedData: result,
        privateKey: testHolder.encryptionPrivKey,
      });
      expect(decrypted).to.be.deep.eq(unknownZkCert);
    });
  });

  describe('Export ZkCert Hash', function () {
    it('should throw error if not confirmed', async function (this: Mocha.Context) {
      this.timeout(5000);
      snapProvider.rpcStubs.snap_dialog.resolves(false);
      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GetZkCertHash),
        snapProvider,
        ethereumProvider,
      );
      await expect(callPromise).to.be.rejectedWith(
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should provide zkCert hash on approval', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert, zkCert2],
        });

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.GetZkCertHash),
        snapProvider,
        ethereumProvider,
      );

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(result).to.be.deep.eq([zkCert.leafHash, zkCert2.leafHash]);
    });
  });

  describe('Update Merkle Root', function () {
    it('should throw error if not confirmed', async function (this: Mocha.Context) {
      this.timeout(5000);
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const updateParams: MerkleProofUpdateRequestParams = {
        updates: [
          {
            proof: zkCert2.merkleProof,
            registryAddr: zkCert.registration.address,
          },
        ],
      };

      const updatePromise = processRpcRequest(
        buildRPCRequest(RpcMethods.UpdateMerkleProof, updateParams),
        snapProvider,
        ethereumProvider,
      );
      await expect(updatePromise).to.be.rejectedWith(
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should complain about updating non existing zkCert', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const updateParams: MerkleProofUpdateRequestParams = {
        updates: [
          {
            proof: zkCert2.merkleProof,
            registryAddr: zkCert.registration.address,
          },
        ],
      };

      const updatePromise = processRpcRequest(
        buildRPCRequest(RpcMethods.UpdateMerkleProof, updateParams),
        snapProvider,
        ethereumProvider,
      );
      await expect(updatePromise).to.be.rejectedWith(
        Error,
        `The zkCert with leaf hash ${zkCert2.leafHash} was not found in the wallet. Please import it before updating the Merkle proof.`,
      );
      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
    });

    it('should successfully update on approval', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert, zkCert2],
        });

      const updateParams: MerkleProofUpdateRequestParams = {
        updates: [
          {
            proof: updatedMerkleProof,
            registryAddr: zkCert.registration.address,
          },
        ],
      };

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.UpdateMerkleProof, updateParams),
        snapProvider,
        ethereumProvider,
      )) as ConfirmationResponse;

      const expectedUpdatedZkCert = { ...zkCert };
      expectedUpdatedZkCert.merkleProof = updatedMerkleProof;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [testHolder],
          zkCerts: [expectedUpdatedZkCert, zkCert2],
          merkleServiceURL: '',
        },
      });
      expect(result.message).to.be.eq(RpcResponseMsg.MerkleProofsUpdated);
    });
  });

  describe('Delete zkCert method', function () {
    beforeEach(function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert, zkCert2],
        });
    });

    it('should throw error if not confirmed', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(null);

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.DeleteZkCert, {}),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedSelect,
      );
    });

    it('should delete zkCert successfully (unambiguous filter)', async function (this: Mocha.Context) {
      this.timeout(4000);
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      expect(
        zkCert.expirationDate,
        'This test assumes that the test zkCerts have different expiration dates. Please regenerate one of them with a different expiration date.',
      ).to.not.be.eq(zkCert2.expirationDate);

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.DeleteZkCert, {
          zkCertStandard: zkCert.zkCertStandard,
          expirationDate: zkCert.expirationDate,
        }),
        snapProvider,
        ethereumProvider,
      )) as ConfirmationResponse;

      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [testHolder],
          zkCerts: [zkCert2],
          merkleServiceURL: '',
        },
      });
      expect(result.message).to.be.eq(RpcResponseMsg.ZkCertDeleted);
    });

    it('should delete zkCert successfully (selection because of too broad filter)', async function (this: Mocha.Context) {
      this.timeout(4000);
      snapProvider.rpcStubs.snap_dialog
        .onFirstCall()
        .resolves(2)
        .onSecondCall()
        .resolves(true);

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.DeleteZkCert, {
          zkCertStandard: zkCert.zkCertStandard,
        }),
        snapProvider,
        ethereumProvider,
      )) as ConfirmationResponse;

      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [testHolder],
          zkCerts: [zkCert],
          merkleServiceURL: '',
        },
      });
      expect(result.message).to.be.eq(RpcResponseMsg.ZkCertDeleted);
    });
  });

  describe('Update merkle proof URL', function () {
    beforeEach(function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });
    });

    it('should throw error if not confirmed', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(null);

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.UpdateMerkleProofURL, {
          url: 'https://test/',
        }),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should update url in state', async function (this: Mocha.Context) {
      const urlUpdate = { url: 'https://test/' };
      snapProvider.rpcStubs.snap_dialog.resolves(true);

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.UpdateMerkleProofURL, urlUpdate),
        snapProvider,
        ethereumProvider,
      )) as ConfirmationResponse;

      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [testHolder],
          zkCerts: [zkCert],
          merkleServiceURL: urlUpdate.url,
        },
      });
      expect(result.message).to.be.eq(RpcResponseMsg.MerkleProofsUpdated);
    });
  });

  describe('Benchmark ZKP Generation', function () {
    it('should throw error if not confirmed', async function (this: Mocha.Context) {
      this.timeout(25000);
      snapProvider.rpcStubs.snap_dialog.resolves(false);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.BenchmarkZKPGen, benchmarkZKPGenParams),
        snapProvider,
        ethereumProvider,
      );
      await expect(callPromise).to.be.rejectedWith(
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should generate Benchmark', async function (this: Mocha.Context) {
      this.timeout(25000);

      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.BenchmarkZKPGen, benchmarkZKPGenParams),
        snapProvider,
        ethereumProvider,
      )) as ZkCertProof;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(snapProvider.rpcStubs.snap_notify).to.have.been.calledOnce;
      // Merkle proof should be up to date and therefore not be fetched
      expect(fetchMock.calls()).to.be.empty;

      await verifyProof(result, 3, exclusion3VKey);
    });
  });

  describe('Fixes', function () {
    it('should find zkCerts with large randomSalt', async function (this: Mocha.Context) {
      this.timeout(5000);
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert2],
        });

      const params: ZkCertSelectionParams = {
        zkCertStandard: ZkCertStandard.ZkKYC,
      };

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.ExportZkCert, params),
        snapProvider,
        ethereumProvider,
      )) as EncryptedZkCert;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(result.holderCommitment).to.be.eq(testHolder.holderCommitment);
    });
  });
});
