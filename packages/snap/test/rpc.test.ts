import chai, { expect } from "chai";
import sinonChai from "sinon-chai";
import chaiAsPromised from "chai-as-promised";
import { processRpcRequest } from "../src/index";
import { mockSnapProvider } from "./wallet.mock";
import { defaultRPCRequest, testAddress, testHolder, testSigForEdDSA, testZkpParams } from "./constants.mock";
import { RpcArgs, StorageState, ZkCertProof } from "../src/types";
import { RpcMethods, RpcResponseErr, RpcResponseMsg } from "../src/rpcEnums";
import { shortenAddrStr } from "../src/utils";
import zkCert from "../../../test/zkCert.json";
import zkCert2 from "../../../test/zkCert2.json";
import { groth16 } from 'snarkjs';
import * as fs from 'fs';


chai.use(sinonChai);
chai.use(chaiAsPromised);

function buildRPCRequest(method: RpcMethods, params: any = []) : RpcArgs {
    let res = defaultRPCRequest;
    res.request.method = method;
    res.request.params = params;
    return res;
}

async function verifyProof(result: ZkCertProof) {
    expect(result.proof.pi_a.length).to.be.eq(3);
    expect(result.proof.pi_b.length).to.be.eq(3);
    expect(result.proof.pi_c.length).to.be.eq(3);
    expect(result.publicSignals.length).to.be.gt(5);

    // verify proof
    const vKey = JSON.parse(fs.readFileSync(
        `${__dirname}/../circuits/ageProofZkKYC/ageProofZkKYC.vkey.json`,
    )
        .toString()
    );
    const verification = await groth16.verify(vKey, result.publicSignals, result.proof);
    expect(verification).to.be.true;
}


describe("Test rpc handler function: getBalance", function () {
    const walletStub = mockSnapProvider();

    beforeEach(function () {
    });

    afterEach(function () {
        walletStub.reset();
    });

    describe("Clear Storage method", function () {
        it("should throw error if not confirmed", async function () {
            walletStub.rpcStubs.snap_confirm.resolves(false);

            const clearPromise = processRpcRequest(buildRPCRequest(RpcMethods.ClearStorage, []), walletStub);

            await expect(clearPromise).to.be.rejectedWith(Error, RpcResponseErr.RejectedConfirm);
        });


        it("should clear storage", async function () {
            walletStub.rpcStubs.snap_confirm.resolves(true);

            const result = await processRpcRequest(buildRPCRequest(RpcMethods.ClearStorage, []), walletStub);

            expect(walletStub.rpcStubs.snap_confirm).to.have.been.calledOnce;
            expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith('get');
            expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith('update', { holders: [], zkCerts: [] });
            expect(result).to.be.eq(RpcResponseMsg.StorageCleared);
        });
    });

    describe("Get Holder Commitment method", function () {
        beforeEach(function () {
            walletStub.rpcStubs.snap_manageState.withArgs("get").resolves({
                holders: [{
                    address: "0x1234",
                    holderCommitment: "0x2345",
                    eddsaKey: "0x3456",
                }],
                zkCerts: []
            });
        });

        it("should throw error if not confirmed", async function () {
            walletStub.rpcStubs.snap_confirm.resolves(false);

            const callPromise = processRpcRequest(buildRPCRequest(RpcMethods.GetHolderCommitment, []), walletStub);

            await expect(callPromise).to.be.rejectedWith(Error, RpcResponseErr.RejectedConfirm);
        });

        it("should return holder commitment", async function () {
            walletStub.rpcStubs.snap_confirm.resolves(true);

            const result = await processRpcRequest(buildRPCRequest(RpcMethods.GetHolderCommitment, []), walletStub);

            expect(walletStub.rpcStubs.snap_confirm).to.have.been.calledOnce;
            expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith('get');
            expect(result).to.be.eq("0x2345");
        });
    });

    describe("Add Holder method", function () {
        it("should add holder successfully", async function () {
            walletStub.rpcStubs.eth_requestAccounts.resolves([testAddress]);
            walletStub.rpcStubs.personal_sign.resolves(testSigForEdDSA);

            const result = await processRpcRequest(buildRPCRequest(RpcMethods.SetupHoldingKey, []), walletStub);

            expect(walletStub.rpcStubs.eth_requestAccounts).to.have.been.calledOnce;
            expect(walletStub.rpcStubs.personal_sign).to.have.been.calledOnce;
            expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith('get');
            expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith('update');
            expect(result).to.be.eq(`Added holder ${shortenAddrStr(testAddress)}`);
        });
    });

    describe("Import zkCert method", function () {
        beforeEach(function () {
            walletStub.rpcStubs.snap_manageState.withArgs("get").resolves({
                holders: [testHolder],
                zkCerts: []
            });
        });

        it("should throw error if not confirmed", async function () {
            walletStub.rpcStubs.snap_confirm.resolves(false);

            const callPromise = processRpcRequest(buildRPCRequest(RpcMethods.ImportZkCert, {zkCert: zkCert}), walletStub);

            await expect(callPromise).to.be.rejectedWith(Error, RpcResponseErr.RejectedConfirm);
        });

        it("should import zkCert successfully", async function () {
            walletStub.rpcStubs.snap_confirm.resolves(true);

            const result = await processRpcRequest(buildRPCRequest(RpcMethods.ImportZkCert, { zkCert: zkCert }), walletStub);

            expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith('get');
            expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith('update');
            expect(result).to.be.eq(RpcResponseMsg.ZkCertImported);
        });
    });

    describe("Generate ZKP method", function () {
        beforeEach(function () {
        });

        it("should throw error if not confirmed", async function () {
            walletStub.rpcStubs.snap_confirm.resolves(false);
            walletStub.rpcStubs.snap_manageState.withArgs("get").resolves({
                holders: [testHolder],
                zkCerts: [zkCert]
            });

            const callPromise = processRpcRequest(buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams), walletStub);

            await expect(callPromise).to.be.rejectedWith(Error, RpcResponseErr.RejectedConfirm);
        });

        it("should generate ZKP successfully", async function (this: Mocha.Context) {
            // extend timeout for this test
            this.timeout(10000);

            walletStub.rpcStubs.snap_confirm.resolves(true);
            walletStub.rpcStubs.snap_manageState.withArgs("get").resolves({
                holders: [testHolder],
                zkCerts: [zkCert]
            });

            const result = (await processRpcRequest(buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams), walletStub)) as ZkCertProof;

            expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith('get');
            expect(walletStub.rpcStubs.snap_confirm).to.have.been.calledOnce;

            await verifyProof(result);
        });

        it("should be able to select from multiple zkCerts", async function () {
            walletStub.rpcStubs.snap_confirm.resolves(true);
            walletStub.rpcStubs.snap_dialog.resolves(1); // TODO: check what is actually returned
            walletStub.rpcStubs.snap_manageState.withArgs("get").resolves({
                holders: [testHolder],
                zkCerts: [zkCert, zkCert2]
            });

            const result = (await processRpcRequest(buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams), walletStub)) as ZkCertProof;

            expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith('get');
            expect(walletStub.rpcStubs.snap_confirm).to.have.been.calledOnce;

            await verifyProof(result);
        });
     });

    describe.skip("TODO: Export zkCert", function () { });
});