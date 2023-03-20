/**
 * Method for unit testing with wallet mock inspired from https://github.com/ChainSafe/filsnap
 */

import { SnapProvider } from '@metamask/snap-types';
import { stub } from 'sinon';

// @ts-expect-error because the mock doesn't implement all methods
class WalletMock implements SnapProvider {
  public readonly registerRpcMessageHandler = stub();

  public readonly requestStub = stub();

  /* eslint-disable @typescript-eslint/naming-convention */
  public readonly rpcStubs = {
    eth_requestAccounts: stub(),
    personal_sign: stub(),
    snap_confirm: stub(),
    snap_getBip44Entropy: stub(),
    snap_getBip44Entropy_461: stub(),
    snap_manageState: stub(),
    web3_clientVersion: stub(),
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  /**
   * Calls this.requestStub or this.rpcStubs[req.method], if the method has
   * a dedicated stub.
   *
   * @param args - Parameters of the request.
   */
  public async request(
    args: Parameters<SnapProvider['request']>[0],
  ): ReturnType<SnapProvider['request']> {
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
      (stubInstance: ReturnType<typeof stub>) => stubInstance.reset(),
    );
  }
}

/**
 * Creates a mock SnapProvider instance.
 *
 * @returns The mock SnapProvider instance.
 */
export function mockSnapProvider(): SnapProvider & WalletMock {
  const mock = new WalletMock();
  // risky hack but it's hard to stub all provider methods
  return mock as any;
}
