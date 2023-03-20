import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { groth16 } from 'snarkjs';

import zkCert from '../../../test/zkCert.json';
import ageProofVKey from '../circuits/ageProofZkKYC/ageProofZkKYC.vkey.json';
import { processRpcRequest } from '../src';
import { RpcMethods, RpcResponseErr, RpcResponseMsg } from '../src/rpcEnums';
import { RpcArgs, ZkCertProof } from '../src/types';
import { shortenAddrStr } from '../src/utils';
import {
  defaultRPCRequest,
  testAddress,
  testHolder,
  testSigForEdDSA,
  testZkpParams,
} from './constants.mock';
import { mockSnapProvider } from './wallet.mock';

chai.use(sinonChai);
chai.use(chaiAsPromised);

/**
 * Hepler to build RPC requests for testing.
 *
 * @param method - The method to be called.
 * @param params - Paramerters to be passed, if any.
 * @returns The RPC request object.
 */
function buildRPCRequest(method: RpcMethods, params: any = []): RpcArgs {
  const res = defaultRPCRequest;
  res.request.method = method;
  res.request.params = params;
  return res;
}

describe('Test rpc handler function: getBalance', function () {
  const walletStub = mockSnapProvider();

  afterEach(function () {
    walletStub.reset();
  });

  describe('Clear Storage method', function () {
    it('should throw error if not confirmed', async function () {
      walletStub.rpcStubs.snap_confirm.resolves(false);

      const clearPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ClearStorage, []),
        walletStub,
      );

      await expect(clearPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should clear storage', async function () {
      walletStub.rpcStubs.snap_confirm.resolves(true);

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.ClearStorage, []),
        walletStub,
      );

      expect(walletStub.rpcStubs.snap_confirm).to.have.been.calledOnce;
      expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith(
        'get',
      );
      expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith(
        'update',
        { holders: [], zkCerts: [] },
      );
      expect(result).to.be.eq(RpcResponseMsg.StorageCleared);
    });
  });

  describe('Get Holder Commitment method', function () {
    beforeEach(function () {
      walletStub.rpcStubs.snap_manageState.withArgs('get').resolves({
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
      walletStub.rpcStubs.snap_confirm.resolves(false);

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GetHolderCommitment, []),
        walletStub,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should return holder commitment', async function () {
      walletStub.rpcStubs.snap_confirm.resolves(true);

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.GetHolderCommitment, []),
        walletStub,
      );

      expect(walletStub.rpcStubs.snap_confirm).to.have.been.calledOnce;
      expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith(
        'get',
      );
      expect(result).to.be.eq('0x2345');
    });
  });

  describe('Add Holder method', function () {
    it('should add holder successfully', async function () {
      walletStub.rpcStubs.eth_requestAccounts.resolves([testAddress]);
      walletStub.rpcStubs.personal_sign.resolves(testSigForEdDSA);

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.SetupHoldingKey, []),
        walletStub,
      );

      expect(walletStub.rpcStubs.eth_requestAccounts).to.have.been.calledOnce;
      expect(walletStub.rpcStubs.personal_sign).to.have.been.calledOnce;
      expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith(
        'get',
      );
      expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith(
        'update',
      );
      expect(result).to.be.eq(`Added holder ${shortenAddrStr(testAddress)}`);
    });
  });

  describe('Import zkCert method', function () {
    beforeEach(function () {
      walletStub.rpcStubs.snap_manageState.withArgs('get').resolves({
        holders: [testHolder],
        zkCerts: [],
      });
    });

    it('should throw error if not confirmed', async function () {
      walletStub.rpcStubs.snap_confirm.resolves(false);

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, { zkCert }),
        walletStub,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should import zkCert successfully', async function () {
      walletStub.rpcStubs.snap_confirm.resolves(true);

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, { zkCert }),
        walletStub,
      );

      expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith(
        'get',
      );
      expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith(
        'update',
      );
      expect(result).to.be.eq(RpcResponseMsg.ZkCertImported);
    });
  });

  describe('Generate ZKP method', function () {
    beforeEach(function () {
      walletStub.rpcStubs.snap_manageState.withArgs('get').resolves({
        holders: [testHolder],
        zkCerts: [zkCert],
      });
    });

    it('should throw error if not confirmed', async function () {
      walletStub.rpcStubs.snap_confirm.resolves(false);

      const callPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams),
        walletStub,
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedConfirm,
      );
    });

    /* eslint-disable jest/no-done-callback, no-invalid-this */
    // (found no better way to increase timeouts for async tests)
    it('should generate ZKP successfully', async function (this: Mocha.Context) {
      // extend timeout for this test because the zk proof generation is slow
      this.timeout(10000);

      walletStub.rpcStubs.snap_confirm.resolves(true);
      const result = (await processRpcRequest(
        buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams),
        walletStub,
      )) as ZkCertProof;

      expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith(
        'get',
      );
      expect(walletStub.rpcStubs.snap_confirm).to.have.been.calledOnce;
      expect(result.proof.pi_a.length).to.be.eq(3);
      expect(result.proof.pi_b.length).to.be.eq(3);
      expect(result.proof.pi_c.length).to.be.eq(3);
      expect(result.publicSignals.length).to.be.gt(5);

      // verify proof
      const verification = await groth16.verify(
        ageProofVKey,
        result.publicSignals,
        result.proof,
      );
      expect(verification).to.be.true;
    });
    /* eslint-enable jest/no-done-callback, no-invalid-this */
  });

  // TODO: describe.skip('Export zkCert', function () {});
});
