# Galactica Snap JSON-RPC API

::: tip Development Version
Metamaks Snaps and the Galactica Snap are pre-release software. To try it, install [MetaMask Flask](https://metamask.io/flask) first and then visit the website connecting to it.
:::

## Table of Contents

[[toc]]

## Connection Methods

#### Description

### `wallet_requestSnaps`

Requests permission for a DApp to communicate with Metamask and the Galactica Snap.

Visit the [Metamask Documentation](https://docs.metamask.io/guide/snaps-rpc-api.html#wallet-requestsnaps) for more details.

#### Example

```javascript
const result = await ethereum.request({
  method: 'wallet_requestSnaps',
  params: {
    'npm:@galactica-corp/snap': {},
  },
});

console.log(result);
// Will print something of the form:
// {
//   "npm:@galactica-corp/snap": {
//     "blocked": false,
//     "enabled": true,
//     "id": "npm:@galactica-corp/snap",
//     "initialPermissions": {
//       "endowment:rpc": {
//         "dapps": true,
//         "snaps": false
//       },
//       "endowment:ethereum-provider": {},
//       "endowment:long-running": {},
//       "snap_notify": {},
//       "snap_dialog": {},
//       "snap_manageState": {}
//     },
//     "permissionName": "wallet_snap_npm:@galactica-corp/snap",
//     "version": "0.2.1"
//   }
// }
```

### `wallet_getSnaps`

#### Description

This method returns the IDs of the caller's permitted snaps and some relevant metadata.

See the [Metamask documentation](https://docs.metamask.io/guide/snaps-rpc-api.html#wallet-getsnaps) for more details.

## Galactica Specific Methods

All folling methods are invoked through the `wallet_invokeSnap` method of the [Metamask RPC-API](https://docs.metamask.io/guide/snaps-rpc-api.html#wallet-invokesnap).

These methods are restricted, meaning that you first need to aquire permission using the connection method.

### `setupHoldingKey`
#### Description
Initial setup of a Galactica wallet that adds a ZK Certificate holder to the Snap by deriving a private key from a signature of the user's wallet.

Asks the user for approval.

#### Parameters
None
#### Returns
`string` The shortened address of the newly created holder.
Throws error if the user rejected a confirmation.
#### Example

### `getHolderCommitment`
#### Description
#### Parameters
#### Returns
#### Example

### `genZkKycProof`
#### Description
#### Parameters
#### Returns
#### Example

### `clearStorage`
#### Description
#### Parameters
#### Returns
#### Example

### `importZkCert`
#### Description
#### Parameters
#### Returns
#### Example

### `exportZkCert`
#### Description
#### Parameters
#### Returns
#### Example

### `listZkCerts`

::: warning Figure out privacy
How to ensure no private data is leaked (requiring confirmation, limitation to connected address, ...)?
:::

#### Description
#### Parameters
#### Returns
#### Example