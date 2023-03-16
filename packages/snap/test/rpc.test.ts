import chai, { expect } from "chai";
import sinonChai from "sinon-chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import { processRpcRequest } from "../src/index";
import { mockSnapProvider, mockEthereumProvider } from "./wallet.mock";
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

function buildRPCRequest(method: RpcMethods, params: any | undefined = undefined): RpcArgs {
    let res = defaultRPCRequest;
    res.request.method = method;
    if (params){
        res.request.params = params;
    }
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


describe("Test rpc handler function", function () {
    const snapProvider = mockSnapProvider();
    const ethereumProvider = mockEthereumProvider();

    beforeEach(function () {
    });

    afterEach(function () {
        expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({ operation: 'get' });
        snapProvider.reset();
    });

    describe("Clear Storage method", function () {
        it("should throw error if not confirmed", async function () {
            snapProvider.rpcStubs.snap_dialog.resolves(false);

            const clearPromise = processRpcRequest(buildRPCRequest(RpcMethods.ClearStorage), snapProvider, ethereumProvider);

            await expect(clearPromise).to.be.rejectedWith(Error, RpcResponseErr.RejectedConfirm);
        });


        it("should clear storage", async function () {
            snapProvider.rpcStubs.snap_dialog.resolves(true);
            snapProvider.rpcStubs.snap_manageState.withArgs({ operation: 'get' }).resolves({
                holders: [testHolder],
                zkCerts: [zkCert]
            });

            const result = await processRpcRequest(buildRPCRequest(RpcMethods.ClearStorage), snapProvider, ethereumProvider);

            expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
            expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({ operation: 'update', newState: { holders: [], zkCerts: [] }});
            expect(result).to.be.eq(RpcResponseMsg.StorageCleared);
        });
    });

    describe("Get Holder Commitment method", function () {
        beforeEach(function () {
            snapProvider.rpcStubs.snap_manageState.withArgs({ operation: 'get' }).resolves({
                holders: [{
                    address: "0x1234",
                    holderCommitment: "0x2345",
                    eddsaKey: "0x3456",
                }],
                zkCerts: []
            });
        });

        it("should throw error if not confirmed", async function () {
            snapProvider.rpcStubs.snap_dialog.resolves(false);

            const callPromise = processRpcRequest(buildRPCRequest(RpcMethods.GetHolderCommitment), snapProvider, ethereumProvider);

            await expect(callPromise).to.be.rejectedWith(Error, RpcResponseErr.RejectedConfirm);
        });

        it("should return holder commitment", async function () {
            snapProvider.rpcStubs.snap_dialog.resolves(true);

            const result = await processRpcRequest(buildRPCRequest(RpcMethods.GetHolderCommitment), snapProvider, ethereumProvider);

            expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;
            expect(result).to.be.eq("0x2345");
        });
    });

    describe("Add Holder method", function () {
        it("should add holder successfully", async function () {
            ethereumProvider.rpcStubs.eth_requestAccounts.resolves([testAddress]);
            ethereumProvider.rpcStubs.personal_sign.resolves(testSigForEdDSA);

            const result = await processRpcRequest(buildRPCRequest(RpcMethods.SetupHoldingKey), snapProvider, ethereumProvider);

            expect(ethereumProvider.rpcStubs.eth_requestAccounts).to.have.been.calledOnce;
            expect(ethereumProvider.rpcStubs.personal_sign).to.have.been.calledOnce;
            expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
                operation: 'update',
                newState: {
                    holders: [testHolder],
                    zkCerts: []
                }
            });
            expect(result).to.be.eq(true);
        });
    });

    describe("Import zkCert method", function () {
        beforeEach(function () {
            snapProvider.rpcStubs.snap_manageState.withArgs({ operation: 'get' }).resolves({
                holders: [testHolder],
                zkCerts: []
            });
        });

        it("should throw error if not confirmed", async function () {
            snapProvider.rpcStubs.snap_dialog.resolves(false);

            const callPromise = processRpcRequest(buildRPCRequest(RpcMethods.ImportZkCert, { zkCert: zkCert }), snapProvider, ethereumProvider);

            await expect(callPromise).to.be.rejectedWith(Error, RpcResponseErr.RejectedConfirm);
        });

        it("should import zkCert successfully", async function () {
            snapProvider.rpcStubs.snap_dialog.resolves(true);

            const result = await processRpcRequest(buildRPCRequest(RpcMethods.ImportZkCert, { zkCert: zkCert }), snapProvider, ethereumProvider);

            expect(snapProvider.rpcStubs.snap_manageState).to.have.been.calledWith({
                operation: 'update',
                newState: {
                    holders: [testHolder],
                    zkCerts: [zkCert]
                }
             });
            expect(result).to.be.eq(RpcResponseMsg.ZkCertImported);
        });
    });

    describe("Generate ZKP method", function () {
        beforeEach(function () {
        });

        it("should throw error if not confirmed", async function () {
            snapProvider.rpcStubs.snap_dialog.resolves(false);
            snapProvider.rpcStubs.snap_manageState.withArgs({ operation: 'get' }).resolves({
                holders: [testHolder],
                zkCerts: [zkCert]
            });

            const callPromise = processRpcRequest(buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams), snapProvider, ethereumProvider);

            await expect(callPromise).to.be.rejectedWith(Error, RpcResponseErr.RejectedConfirm);
        });

        it("should generate ZKP successfully", async function (this: Mocha.Context) {
            // extend timeout for this test
            this.timeout(10000);

            snapProvider.rpcStubs.snap_dialog.resolves(true);
            snapProvider.rpcStubs.snap_manageState.withArgs({ operation: 'get' }).resolves({
                holders: [testHolder],
                zkCerts: [zkCert]
            });

            const result = (await processRpcRequest(buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams), snapProvider, ethereumProvider)) as ZkCertProof;

            expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledOnce;

            await verifyProof(result);
        });

        it("should be able to select from multiple zkCerts", async function (this: Mocha.Context) {
            this.timeout(10000);

            snapProvider.rpcStubs.snap_dialog.withArgs(sinon.match.has('type', 'Confirmation')).resolves(true);
            snapProvider.rpcStubs.snap_dialog.withArgs(sinon.match.has('type', 'Prompt')).resolves(1); // The text entered by the user
            snapProvider.rpcStubs.snap_manageState.withArgs({ operation: 'get' }).resolves({
                holders: [testHolder],
                zkCerts: [zkCert, zkCert2]
            });

            const result = (await processRpcRequest(buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams), snapProvider, ethereumProvider)) as ZkCertProof;

            expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledTwice;

            await verifyProof(result);
        });

        it("should reject when user refuses zkCert selection", async function () {
            snapProvider.rpcStubs.snap_manageState.withArgs({ operation: 'get' }).resolves({
                holders: [testHolder],
                zkCerts: [zkCert, zkCert2]
            });
            snapProvider.rpcStubs.snap_dialog.withArgs(sinon.match.has('type', 'Confirmation')).resolves(true);
            snapProvider.rpcStubs.snap_dialog.withArgs(sinon.match.has('type', 'Prompt')).resolves(null); // user clicked reject or entered nothing before pressing accept

            const callPromise = processRpcRequest(buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams), snapProvider, ethereumProvider);

            await expect(callPromise).to.be.rejectedWith(Error, RpcResponseErr.RejectedSelect);

            expect(snapProvider.rpcStubs.snap_dialog).to.have.been.calledTwice;
        });

        it("should repeat zkCert selection if user enters garbage", async function () {
            snapProvider.rpcStubs.snap_manageState.withArgs({ operation: 'get' }).resolves({
                holders: [testHolder],
                zkCerts: [zkCert, zkCert2]
            });
            snapProvider.rpcStubs.snap_dialog.withArgs(sinon.match.has('type', 'Confirmation')).resolves(true);
            snapProvider.rpcStubs.snap_dialog.withArgs(sinon.match.has('type', 'Prompt')).
                onFirstCall().resolves('garbage'). // no valid number
                onSecondCall().resolves(10000000). // index out of bounds
                onThirdCall().resolves(null); // user clicked reject or entered nothing before pressing accept

            const callPromise = processRpcRequest(buildRPCRequest(RpcMethods.GenZkKycProof, testZkpParams), snapProvider, ethereumProvider);

            await expect(callPromise).to.be.rejectedWith(Error, RpcResponseErr.RejectedSelect);

            expect(snapProvider.rpcStubs.snap_dialog).to.have.been.callCount(4);
            expect(snapProvider.rpcStubs.snap_notify).to.have.been.calledTwice;
        });
    });

    describe.skip("TODO: Export zkCert", function () { });
});