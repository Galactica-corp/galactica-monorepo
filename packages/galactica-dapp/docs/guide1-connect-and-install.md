# Galactica Front End Guide

This guide introduces you to the example front-end that is meant as a reference on how to utilize Galactica features.

Here we explain how the example works. Instructions on how to install, run and test the example can be found [here](../../../README.md) and [there](../README.md).

## Connect to Galactica Snap

Before the Galactica Snap can be installed, we need to check that Metamask is available in the user's browser. This is similar to a [standard Metamask connection](https://docs.metamask.io/wallet/get-started/set-up-dev-environment).

As long as Snaps are exclusive to Metamask Flask, we need to check that Flask is installed:

```typescript
/**
 * Detect if the wallet injecting the ethereum object is Flask.
 *
 * @returns True if the MetaMask version is Flask, false otherwise.
 */
export const isFlask = async () => {
  const provider = window.ethereum;

  try {
    const clientVersion = await provider?.request({
      method: 'web3_clientVersion',
    });

    const isFlaskDetected = (clientVersion as string[])?.includes('flask');

    return Boolean(provider && isFlaskDetected);
  } catch {
    return false;
  }
};
```

If Metamask/Flask is not installed, you can forward the user with the connect button to the install page:

```typescript
export const InstallFlaskButton = () => (
  <Link href="https://metamask.io/flask/" target="_blank">
    <FlaskFox />
    <ButtonText>Install MetaMask Flask</ButtonText>
  </Link>
);
```

With Metamask present, the user can connect to the Galactica Snap and install it if necessary (missing or outdated) with the following function:

```typescript
const defaultSnapOrigin = 'npm:@galactica-corp/snap';

await window.ethereum.request({
  method: 'wallet_requestSnaps',
  params: {
    [defaultSnapOrigin]: {},
  },
});
```

You can verify if the Snap is installed:

```typescript
/**
 * Get the snap from MetaMask.
 *
 * @returns The snap object returned by the extension.
 */
export const getSnap = async (): Promise<Snap | undefined> => {
  try {
    const snaps = await window.ethereum.request({
      method: 'wallet_getSnaps',
    });

    return Object.values(snaps).find((snap) => snap.id === defaultSnapOrigin);
  } catch (error) {
    console.log('Failed to obtain installed snap', error);
    return undefined;
  }
};
```

Now you should be able to use [Galactica specific functions](../../snap/docs/rpcAPI.md) through the snap using the [wallet_invokeSnap method](https://docs.metamask.io/snaps/reference/rpc-api#wallet_invokesnap).
See the next page for an example
