import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { match } from 'sinon';
import sinonChai from 'sinon-chai';
import { groth16 } from 'snarkjs';

import zkCert from '../../../test/zkCert.json';
import zkCert2 from '../../../test/zkCert2.json';
import ageProofVKey from '../../galactica-dapp/public/provers/ageProofZkKYC.vkey.json';
import { processRpcRequest } from '../src';
import { RpcMethods, RpcResponseErr, RpcResponseMsg } from '../src/rpcEnums';
import { ExportRequestParams, RpcArgs, ZkCertProof } from '../src/types';
import {
  defaultRPCRequest,
  testEntropy,
  testHolder,
  testZkpParams,
  testEdDSAKey,
} from './constants.mock';
import { mockSnapProvider, mockEthereumProvider } from './wallet.mock';
import { calculateHolderCommitment } from '../src/zkCertHandler';

chai.use(sinonChai);
chai.use(chaiAsPromised);

/**
 * Helper to build RPC requests for testing.
 *
 * @param method - The method to be called.
 * @param params - Parameters to be passed, if any.
 * @returns The RPC request object.
 */
function buildRPCRequest(
  method: RpcMethods,
  params: any | undefined = undefined,
): RpcArgs {
  const res = defaultRPCRequest;
  res.request.method = method;
  if (params) {
    res.request.params = params;
  }
  return res;
}

/**
 * Verifies a proof and expects it to be valid.
 *
 * @param result - The proof to be verified.
 */
async function verifyProof(result: ZkCertProof) {
  expect(result.proof.pi_a.length).to.be.eq(3);
  expect(result.proof.pi_b.length).to.be.eq(3);
  expect(result.proof.pi_c.length).to.be.eq(3);
  expect(result.publicSignals.length).to.be.gt(5);

  const verification = await groth16.verify(
    ageProofVKey,
    result.publicSignals,
    result.proof,
  );
  expect(verification).to.be.true;
}

describe('Test rpc handler function', function () {
  const snapProvider = mockSnapProvider();
  const ethereumProvider = mockEthereumProvider();

  beforeEach(function () {
    snapProvider.rpcStubs.snap_getEntropy.resolves(testEntropy);
  });

  afterEach(function () {
    expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
      operation: 'get',
    });
    snapProvider.reset();
  });

  describe('Clear Storage method', function () {
    it('should throw error if not confirmed', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const clearPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ClearStorage),
        snapProvider,
        ethereumProvider,
      );

      await expect(clearPromise).to.be.rejectedWith(
        Error,
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

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.ClearStorage),
        snapProvider,
        ethereumProvider,
      );

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: { holders: [], zkCerts: [] },
      });
      expect(result).to.be.eq(RpcResponseMsg.StorageCleared);
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
              eddsaKey: '0x3456',
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
        Error,
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should return holder commitment', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(true);

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.GetHolderCommitment),
        snapProvider,
        ethereumProvider,
      );

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(result).to.be.eq('0x2345');
    });
  });

  describe('Add Holder method', function () {
    /* eslint-disable jest/no-done-callback, no-invalid-this */
    it('should add holder successfully', async function (this: Mocha.Context) {
      this.timeout(4000);
      /* eslint-enable jest/no-done-callback, no-invalid-this */     
      snapProvider.rpcStubs.snap_dialog.resolves(true);

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, { zkCert }),
        snapProvider,
        ethereumProvider,
      );

      // even with no holder configured before, the snap should add the holder from the getEntropy method
      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [{eddsaKey: testEntropy, holderCommitment: await calculateHolderCommitment(testEntropy)}],
          zkCerts: [zkCert],
        },
      });
    });
  });

  describe('Import zkCert method', function () {
    beforeEach(function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [],
        });
    });

    it('should throw error if not confirmed', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, { zkCert }),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should import zkCert successfully', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(true);

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, { zkCert }),
        snapProvider,
        ethereumProvider,
      );

      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [testHolder],
          zkCerts: [zkCert],
        },
      });
      expect(result).to.be.eq(RpcResponseMsg.ZkCertImported);
    });
  });

  describe('Generate ZKP method', function () {
    it('should throw error if not confirmed', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(false);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedConfirm,
      );
    });

    /* eslint-disable jest/no-done-callback, no-invalid-this */
    // (found no better way to increase timeouts for async tests)
    it('should generate ZKP successfully', async function (this: Mocha.Context) {
      this.timeout(15000);
      /* eslint-enable jest/no-done-callback, no-invalid-this */

      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams),
        snapProvider,
        ethereumProvider,
      )) as ZkCertProof;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;

      await verifyProof(result);
    });

    /* eslint-disable jest/no-done-callback, no-invalid-this */
    it('should be able to select from multiple zkCerts', async function (this: Mocha.Context) {
      this.timeout(15000);
      /* eslint-enable jest/no-done-callback, no-invalid-this */

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
        buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams),
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
        .withArgs(match.has('type', 'confirmation'))
        .resolves(true);
      snapProvider.rpcStubs.snap_dialog
        .withArgs(match.has('type', 'prompt'))
        .resolves(null); // user clicked reject or entered nothing before pressing accept

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedSelect,
      );

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledTwice;
    });

    it('should repeat zkCert selection if user enters garbage', async function () {
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert, zkCert2],
        });
      snapProvider.rpcStubs.snap_dialog
        .withArgs(match.has('type', 'confirmation'))
        .resolves(true);
      snapProvider.rpcStubs.snap_dialog
        .withArgs(match.has('type', 'prompt'))
        .onFirstCall()
        .resolves('garbage') // no valid number
        .onSecondCall()
        .resolves(10000000) // index out of bounds
        .onThirdCall()
        .resolves(null); // user clicked reject or entered nothing before pressing accept

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedSelect,
      );

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.callCount(4);
      expect(snapProvider.rpcStubs.snap_notify).to.have.been.calledTwice;
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
        buildRPCRequest(RpcMethods.ListZkCerts, testZkpParams),
        snapProvider,
        ethereumProvider,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
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
      expect(res[zkCert.zkCertStandard][0].providerPubKey.Ax).to.equal(
        zkCert.providerData.Ax,
      );
      expect(res[zkCert.zkCertStandard][0].providerPubKey.Ay).to.equal(
        zkCert.providerData.Ay,
      );
      expect(res[zkCert.zkCertStandard][0].expirationDate).to.equal(
        zkCert.content.expirationDate,
      );
      expect(res[zkCert.zkCertStandard][1].expirationDate).to.equal(
        zkCert2.content.expirationDate,
      );
      expect(res[zkCert.zkCertStandard][0].verificationLevel).to.equal(
        zkCert2.content.verificationLevel,
      );
      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
    });
  });

  describe('Get ZkCert Storage hash', function () {
    afterEach(function () {
      expect(snapProvider.rpcStubs.snap_dialog).to.not.have.been.called;
    });

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
    });
  });

  describe('Export zkCert', function () {
    it('should throw error if not confirmed', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const params: ExportRequestParams = {
        zkCertStandard: 'gip69',
      };

      const clearPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ClearStorage, params),
        snapProvider,
        ethereumProvider,
      );

      await expect(clearPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedConfirm,
      );
    });

    /* eslint-disable jest/no-done-callback, no-invalid-this */
    it('should provide zkCert on approval', async function (this: Mocha.Context) {
      this.timeout(5000);
      /* eslint-enable jest/no-done-callback, no-invalid-this */
      snapProvider.rpcStubs.snap_dialog.resolves(true);
      snapProvider.rpcStubs.snap_manageState
        .withArgs({ operation: 'get' })
        .resolves({
          holders: [testHolder],
          zkCerts: [zkCert],
        });

      const params: ExportRequestParams = {
        zkCertStandard: 'gip69',
      };

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.ExportZkCert, params),
        snapProvider,
        ethereumProvider,
      );

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(result).to.be.eq(zkCert);
    });
  });

  describe('Export ZkCert Hash', function () {
    it('should throw error if not confirmed', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(false);
      const clearPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GetZkCertHash),
        snapProvider,
        ethereumProvider,
      );
      await expect(clearPromise).to.be.rejectedWith(
        Error,
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
});
