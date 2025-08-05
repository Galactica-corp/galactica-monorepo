/**
 * Method for unit testing with wallet mock inspired from https://github.com/ChainSafe/filsnap
 */
import type { MetaMaskInpageProvider } from '@metamask/providers';
import type { SnapsGlobalObject } from '@metamask/snaps-types';
import { stub } from 'sinon';

class ProviderMock {
  public readonly registerRpcMessageHandler = stub();

  public readonly requestStub = stub();

  public readonly rpcStubs: any;

  /**
   * Calls this.requestStub or this.rpcStubs[req.method], if the method has
   * a dedicated stub.
   * @param args - Parameters of the request.
   * @returns A stubbed response.
   */
  public async request(
    args: Parameters<SnapsGlobalObject['request']>[0],
  ): Promise<unknown> {
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
  public readonly registerRpcMessageHandler = stub();

  public readonly requestStub = stub();

  /* eslint-disable @typescript-eslint/naming-convention */
  public readonly rpcStubs = {
    snap_notify: stub(),
    snap_dialog: stub(),
    snap_getBip44Entropy: stub(),
    snap_getBip44Entropy_461: stub(),
    snap_manageState: stub(),
    snap_getEntropy: stub(),
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  public reset(): void {
    this.registerRpcMessageHandler.reset();
    this.requestStub.reset();
    Object.values(this.rpcStubs).forEach(
      (stubInstance: ReturnType<typeof stub>) => stubInstance.reset(),
    );
  }
}

class EthereumMock extends ProviderMock {
  public readonly registerRpcMessageHandler = stub();

  public readonly requestStub = stub();

  /* eslint-disable @typescript-eslint/naming-convention */
  public readonly rpcStubs = {
    eth_requestAccounts: stub(),
    personal_sign: stub(),
    web3_clientVersion: stub(),
    eth_chainId: stub(),
    eth_call: stub(),
    wallet_switchEthereumChain: stub(),
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  public reset(): void {
    this.registerRpcMessageHandler.reset();
    this.requestStub.reset();
    Object.values(this.rpcStubs).forEach(
      (stubInstance: ReturnType<typeof stub>) => stubInstance.reset(),
    );
  }
}

/**
 * Creates a mock SnapProvider instance.
 * @returns The mock SnapProvider instance.
 */
export function mockSnapProvider(): SnapsGlobalObject & SnapMock {
  const mock = new SnapMock();
  // risky hack but it's hard to stub all provider methods
  return mock as any as SnapsGlobalObject & SnapMock;
}

/**
 * Creates a mock EthereumProvider instance.
 * @returns The mock EthereumProvider instance.
 */
export function mockEthereumProvider(): MetaMaskInpageProvider & EthereumMock {
  const mock = new EthereumMock();
  // risky hack but it's hard to stub all provider methods
  return mock as any as MetaMaskInpageProvider & EthereumMock;
}
