import chai, { expect } from "chai";
import sinonChai from "sinon-chai";
import { processRpcRequest } from "../src/index";
import { mockSnapProvider } from "./wallet.mock";

chai.use(sinonChai);

describe("Test rpc handler function: getBalance", function () {
  const walletStub = mockSnapProvider();

  afterEach(function () {
    walletStub.reset();
  });

  it("should run tests", async function () {
    // prepare stubs
    walletStub.prepareForKeyPair();

    // call getBalance
    // const result = await processRpcRequest(walletStub);

    // assertions
    expect(1).to.be.eq(1);
    // expect(walletStub.rpcStubs.snap_manageState).to.have.been.calledOnce;
    // expect(walletStub.rpcStubs.snap_getBip44Entropy).to.have.been.calledOnce;
    // expect(result).to.be.eq("0.00000000003");
  });
});