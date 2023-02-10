/**
 * Method for unit testing with wallet mock inspired from https://github.com/ChainSafe/filsnap
 */

import { SnapProvider } from "@metamask/snap-types";
import sinon from "sinon";

//@ts-expect-error
class WalletMock implements SnapProvider {
  public readonly registerRpcMessageHandler = sinon.stub();

  public readonly requestStub = sinon.stub();

  public readonly rpcStubs = {
    eth_requestAccounts: sinon.stub(),
    personal_sign: sinon.stub(),
    snap_confirm: sinon.stub(),
    snap_getBip44Entropy: sinon.stub(),
    snap_getBip44Entropy_461: sinon.stub(),
    snap_manageState: sinon.stub(),
    web3_clientVersion: sinon.stub(),
  };

  /**
   * Calls this.requestStub or this.rpcStubs[req.method], if the method has
   * a dedicated stub.
   */
  public request(
    args: Parameters<SnapProvider["request"]>[0]
  ): ReturnType<SnapProvider["request"]> {
    const { method, params = [] } = args;
    if (Object.hasOwnProperty.call(this.rpcStubs, method)) {
      // eslint-disable-next-line
      return (this.rpcStubs as any)[method](...(Array.isArray(params) ? params : [params]));
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.requestStub(args);
  }

  public reset(): void {
    this.registerRpcMessageHandler.reset();
    this.requestStub.reset();
    Object.values(this.rpcStubs).forEach(
      (stub: ReturnType<typeof sinon.stub>) => stub.reset()
    );
  }
}

//risky hack but it's hard to stub all provider methods
export function mockSnapProvider(): SnapProvider & WalletMock {
  const mock = new WalletMock();
  return mock as any as SnapProvider & WalletMock;
}