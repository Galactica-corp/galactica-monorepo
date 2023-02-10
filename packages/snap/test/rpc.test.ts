import chai, { expect } from "chai";
import sinonChai from "sinon-chai";
import chaiAsPromised from "chai-as-promised";
import { processRpcRequest } from "../src/index";
import { mockSnapProvider } from "./wallet.mock";
import { defaultRPCRequest, testAddress, testHolder, testSigForEdDSA } from "./constants.mock";
import { RpcArgs, StorageState } from "../src/types";
import { RpcMethods, RpcResponseErr, RpcResponseMsg } from "../src/rpcEnums";
import { shortenAddrStr } from "../src/utils";
import zkCert from "../../../test/zkCert.json";


chai.use(sinonChai);
chai.use(chaiAsPromised);

function buildRPCRequest(method: RpcMethods, params: any = []) : RpcArgs {
    let res = defaultRPCRequest;
    res.request.method = method;
    res.request.params = params;
    return res;
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

        it("should add holder successfully", async function () {
            walletStub.rpcStubs.snap_confirm.resolves(true);

            const result = await processRpcRequest(buildRPCRequest(RpcMethods.ImportZkCert, { zkCert: zkCert }), walletStub);

            expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith('get');
            expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledWith('update');
            expect(result).to.be.eq(RpcResponseMsg.ZkCertImported);
        });
    });

    describe.skip("TODO: Generate ZKP", function () { });
    describe.skip("TODO: Export zkCert", function () { });
});