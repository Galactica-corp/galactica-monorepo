import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { match } from 'sinon';
import sinonChai from 'sinon-chai';
import { groth16 } from 'snarkjs';

import updatedMerkleProof from '../../../test/updatedMerkleProof.json';
import zkCert from '../../../test/zkCert.json';
import zkCert2 from '../../../test/zkCert2.json';
import zkKYCToImportInUnitTest from '../../../test/zkKYCToImportInUnitTest.json';
import exampleMockDAppVKey from '../../galactica-dapp/public/provers/exampleMockDApp.vkey.json';
import { processRpcRequest } from '../src';
import { RpcMethods, RpcResponseErr, RpcResponseMsg } from '../src/rpcEnums';
import {
  ExportRequestParams,
  RpcArgs,
  ZkCertProof,
  MerkleProofUpdateRequestParams,
} from '../src/types';
import { calculateHolderCommitment } from '../src/zkCertHandler';
import {
  defaultRPCRequest,
  testEntropy,
  testHolder,
  testZkpParams,
} from './constants.mock';
import { mockSnapProvider } from './wallet.mock';

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
    exampleMockDAppVKey,
    result.publicSignals,
    result.proof,
  );
  expect(verification).to.be.true;
}

describe('Test rpc handler function', function () {
  const snapProvider = mockSnapProvider();

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
    /* eslint-disable jest/no-done-callback, no-invalid-this */
    // (found no better way to increase timeouts for async tests)
    it('should throw error if not confirmed', async function (this: Mocha.Context) {
      this.timeout(4000);
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const clearPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ClearStorage),
        snapProvider,
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
      );

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(result).to.be.eq('0x2345');
    });
  });

  describe('Add Holder method', function () {
    it('should add holder successfully', async function (this: Mocha.Context) {
      this.timeout(4000);
      snapProvider.rpcStubs.snap_dialog.resolves(true);

      await processRpcRequest(
        buildRPCRequest(RpcMethods.ImportZkCert, { zkCert: zkKYCToImportInUnitTest }),
        snapProvider,
      );

      // even with no holder configured before, the snap should add the holder from the getEntropy method
      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [
            {
              eddsaKey: testEntropy,
              holderCommitment: await calculateHolderCommitment(testEntropy),
            },
          ],
          zkCerts: [zkKYCToImportInUnitTest],
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
      );

      await expect(callPromise).to.be.rejectedWith(
        Error,
        RpcResponseErr.RejectedConfirm,
      );
    });

    it('should generate ZKP successfully', async function (this: Mocha.Context) {
      this.timeout(20000);

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
      )) as ZkCertProof;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;

      await verifyProof(result);
    });

    it('should be able to select from multiple zkCerts', async function (this: Mocha.Context) {
      this.timeout(20000);

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
      );

      expect(res).to.have.key(zkCert.zkCertStandard);
      expect(res[zkCert.zkCertStandard].length).to.equal(2);
      expect(
        res[zkCert.zkCertStandard][0].providerPubKey.Ax,
        'testing providerPubKey.Ax',
      ).to.equal(zkCert.providerData.Ax);
      expect(
        res[zkCert.zkCertStandard][0].providerPubKey.Ay,
        'testing providerPubKey.Ay',
      ).to.equal(zkCert.providerData.Ay);
      expect(
        res[zkCert.zkCertStandard][0].expirationDate,
        'testing expiration date of 0',
      ).to.equal(zkCert.content.expirationDate);
      expect(
        res[zkCert.zkCertStandard][1].expirationDate,
        'testing expiration date of 1',
      ).to.equal(zkCert2.content.expirationDate);
      expect(
        res[zkCert.zkCertStandard][1].verificationLevel,
        'testing verification level',
      ).to.equal(zkCert2.content.verificationLevel);
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
      );
      const hashes1 = await processRpcRequest(
        buildRPCRequest(RpcMethods.GetZkCertStorageHashes),
        snapProvider,
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
      );
      const hashes1 = await processRpcRequest(
        buildRPCRequest(RpcMethods.GetZkCertStorageHashes),
        snapProvider,
      );

      expect(hashes0).to.have.key(zkCert.zkCertStandard);
      expect(hashes1).to.have.key(zkCert.zkCertStandard);
      expect(hashes0).to.not.deep.equal(hashes1);
    });
  });

  describe('Export zkCert', function () {
    it('should throw error if not confirmed', async function (this: Mocha.Context) {
      this.timeout(5000);
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const params: ExportRequestParams = {
        zkCertStandard: 'gip69',
      };

      const clearPromise = processRpcRequest(
        buildRPCRequest(RpcMethods.ClearStorage, params),
        snapProvider,
      );

      await expect(clearPromise).to.be.rejectedWith(
        Error,
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

      const params: ExportRequestParams = {
        zkCertStandard: 'gip69',
      };

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.ExportZkCert, params),
        snapProvider,
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
      );

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(result).to.be.deep.eq([zkCert.leafHash, zkCert2.leafHash]);
    });
  });

  describe('Update Merkle Root', function () {
    it('should throw error if not confirmed', async function () {
      snapProvider.rpcStubs.snap_dialog.resolves(false);

      const updateParams: MerkleProofUpdateRequestParams = {
        proofs: [{ leaf: zkCert.leafHash, ...zkCert.merkleProof }],
      };

      const updatePromise = processRpcRequest(
        buildRPCRequest(RpcMethods.UpdateMerkleProof, updateParams),
        snapProvider,
      );
      await expect(updatePromise).to.be.rejectedWith(
        Error,
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
        proofs: [{ leaf: zkCert2.leafHash, ...zkCert2.merkleProof }],
      };

      const updatePromise = processRpcRequest(
        buildRPCRequest(RpcMethods.UpdateMerkleProof, updateParams),
        snapProvider,
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
        proofs: [updatedMerkleProof],
      };

      const result = await processRpcRequest(
        buildRPCRequest(RpcMethods.UpdateMerkleProof, updateParams),
        snapProvider,
      );

      const expectedUpdatedZkCert = { ...zkCert };
      expectedUpdatedZkCert.merkleProof = updatedMerkleProof;

      expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
      expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
        operation: 'update',
        newState: {
          holders: [testHolder],
          zkCerts: [expectedUpdatedZkCert, zkCert2],
        },
      });
      expect(result).to.be.eq(RpcResponseMsg.MerkleProofsUpdated);
    });
  });
});
