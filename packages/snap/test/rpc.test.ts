import chai, { expect } from "chai";
import sinonChai from "sinon-chai";
import chaiAsPromised from "chai-as-promised";
import { processRpcRequest } from "../src/index";
import { mockSnapProvider } from "./wallet.mock";
import { defaultRPCRequest } from "./constants.mock";
import { RpcArgs } from "../src/types";
import { RpcMethods, RpcResponseErr, RpcResponseMsg } from "../src/rpcEnums";

chai.use(sinonChai);
chai.use(chaiAsPromised);

function buildRPCRequest(method: RpcMethods, params: any[] = []) : RpcArgs {
    let res = defaultRPCRequest;
    res.request.method = method;
    res.request.params = params;
    return res;
}


describe("Test rpc handler function: getBalance", function () {
    const walletStub = mockSnapProvider();

    beforeEach(function () {
        // prepare stubs
        walletStub.prepareForKeyPair();
    });

    afterEach(function () {
        walletStub.reset();
    });

    describe("Clear Storage method", function () {
        it("should throw error if not confirmed", async function () {
            walletStub.rpcStubs.snap_confirm.resolves(false);

            const clearPromise = processRpcRequest(buildRPCRequest(RpcMethods.ClearStorage, []), walletStub);

            await expect(clearPromise).to.be.rejectedWith(Error, RpcResponseErr.Rejected);
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
});