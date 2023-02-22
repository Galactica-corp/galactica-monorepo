/**
 * Method for unit testing with wallet mock inspired from https://github.com/ChainSafe/filsnap
 */

import { SnapsGlobalObject } from "@metamask/snaps-types";
import { MetaMaskInpageProvider } from "@metamask/providers";
import sinon from "sinon";


class ProviderMock implements SnapsGlobalObject {
  public readonly registerRpcMessageHandler = sinon.stub();

  public readonly requestStub = sinon.stub();

  public readonly rpcStubs: any;

  /**
   * Calls this.requestStub or this.rpcStubs[req.method], if the method has
   * a dedicated stub.
   */
  public request(
    args: Parameters<SnapsGlobalObject["request"]>[0]
  ): ReturnType<SnapsGlobalObject["request"]> {
    const { method, params = [] } = args;
    if (Object.hasOwnProperty.call(this.rpcStubs, method)) {
      // eslint-disable-next-line
      return (this.rpcStubs)[method](...(Array.isArray(params) ? params : [params]));
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.requestStub(args);
  }
}

class SnapMock extends ProviderMock {
  public readonly registerRpcMessageHandler = sinon.stub();

  public readonly requestStub = sinon.stub();

  public readonly rpcStubs = {
    snap_confirm: sinon.stub(),
    snap_notify: sinon.stub(),
    snap_dialog: sinon.stub(),
    snap_getBip44Entropy: sinon.stub(),
    snap_getBip44Entropy_461: sinon.stub(),
    snap_manageState: sinon.stub(),
  };

  public reset(): void {
    this.registerRpcMessageHandler.reset();
    this.requestStub.reset();
    Object.values(this.rpcStubs).forEach(
      (stub: ReturnType<typeof sinon.stub>) => stub.reset()
    );
  }
}

class EthereumMock extends ProviderMock {
  public readonly registerRpcMessageHandler = sinon.stub();

  public readonly requestStub = sinon.stub();

  public readonly rpcStubs = {
    eth_requestAccounts: sinon.stub(),
    personal_sign: sinon.stub(),
    web3_clientVersion: sinon.stub(),
  };

  public reset(): void {
    this.registerRpcMessageHandler.reset();
    this.requestStub.reset();
    Object.values(this.rpcStubs).forEach(
      (stub: ReturnType<typeof sinon.stub>) => stub.reset()
    );
  }
}

//risky hack but it's hard to stub all provider methods
export function mockSnapProvider(): SnapsGlobalObject & SnapMock {
  const mock = new SnapMock();
  return mock as any as SnapsGlobalObject & SnapMock;
}

//risky hack but it's hard to stub all provider methods
export function mockEthereumProvider(): MetaMaskInpageProvider & EthereumMock {
  const mock = new EthereumMock();
  return mock as any as MetaMaskInpageProvider & EthereumMock;
}
