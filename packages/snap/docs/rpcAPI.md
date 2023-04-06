# Galactica Snap JSON-RPC API

## Connection Methods

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

`boolean` - `true` if the user accepted the confirmation and the holder was created or already existed; `false` otherwise.
Throws an error if the user rejected a confirmation.

#### Example

```javascript
await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: defaultSnapOrigin,
    request: {
      method: 'setupHoldingKey',
    },
  },
});
```

### `getHolderCommitment`

#### Description

Asks the Snap to return the holder commitment needed for issuing new zkCertificates.

#### Parameters

None

#### Returns

`string` - The holder commitment in decimal representation.

Throws error if the user rejects the confirmation.

#### Example

```javascript
const holderCommitment = await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: defaultSnapOrigin,
    request: {
      method: RpcMethods.GetHolderCommitment,
    },
  },
});
```

### `genZkKycProof`

#### Description

Sends a request for generating a ZK proof in the Snap. It is generic because you can request different kind of ZK proof depending on the parameters.

Shows the user what is going to be proven and asks for confirmation.

#### Parameters

- `Object`
  - `input` - An `object`, containing public ZKP input for the statements to be shown by the generated proof.
  - `requriements` - `object`
    - `zkCertStandard`: `string` for the standard of the zkCertificate that should be used for the proof.
  - `wasm` - `string` base64 encoded wasm binary of the prover. The wasm can be generated using circom and encoded with the script in `src/scripts/proofGenerationPrep.ts`.
  - `zkeyHeader` - `object` of zkey headers used by snarkjs. The binary fields are base64 encoded.
  - `zkeySections` - `array` of base64 encoded zkey sections used by snarkjs.

#### Returns

Generated proof on accepted confirmation and successful computation.
Throws error otherwise.

- `Object`
  - `proof` - `object`
    - `pi_a` - `object` holding proof verification data.
    - `pi_b` - `object` holding proof verification data.
    - `pi_c` - `object` holding proof verification data.
    - `protocol` - `string` Protocol used for ZKP, usually "groth16".
    - `curve` - `string` Curve used for ZKP, usually "bn128".
  - `publicSignals`: `array` List of public inputs for the proof as decimal strings.

#### Example

```javascript
// Requesting proof for zkKYC and age >= 18

// expected time for between pressing the generation button and the verification happening on-chain
const estimatedProofCreationDuration = 20;

const currentTimestamp =
  (await getCurrentBlockTime()) + stimatedProofCreationDuration;
const dateNow = new Date(currentTimestamp * 1000);

const publicInput = {
  currentTime: currentTimestamp,
  currentYear: dateNow.getUTCFullYear().toString(),
  currentMonth: (dateNow.getUTCMonth() + 1).toString(),
  currentDay: dateNow.getUTCDate().toString(),
  ageThreshold: '18',
};

return await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: defaultSnapOrigin,
    request: {
      method: RpcMethods.GenZkKycProof,
      params: {
        input: publicInput,
        requirements: {
          zkCertStandard: 'gip69',
        },
        wasm: proverData.wasm,
        zkeyHeader: proverData.zkeyHeader,
        zkeySections: proverData.zkeySections,
      },
    },
  },
});

// Should return something like:
// {
//   "proof": {
//     "pi_a": [
//       "17407499557855479094412111859538240424111472258125783015858813919815373704619",
//       "18128677868601693983827893970719326131214195171042021234179379044169730862651",
//       "1"
//     ],
//     "pi_b": [
//       [
//         "17792771401466707362701636891264864127929589644831579368515954432422229774445",
//         "13322517950661839404366860539623846150703987405896094568766754897006695020304"
//       ],
//       [
//         "159187298954882081522062472144132288168610805554524398765911845338289258212",
//         "15657949055482864856641089614049190837954674706375448381006265359982794480149"
//       ],
//       [
//         "1",
//         "0"
//       ]
//     ],
//     "pi_c": [
//       "3040903384873419199294037770869928465455153606144433400954341650060775903677",
//       "146329608595190310527006670514062849554280797627326909476418461538368213705",
//       "1"
//     ],
//     "protocol": "groth16",
//     "curve": "bn128"
//   },
//   "publicSignals": [
//     "1",
//     "11209916212079559410136633032138482335659351203987398533814440017698336323514",
//     "1678883749",
//     "478873986970679317615613077202381596613806366113",
//     "2023",
//     "3",
//     "15",
//     "18"
//   ]
// }
```

### `clearStorage`

#### Description

Request for removing data stored in the Snap (holders and zkCertificates).

Asks the user for confirmation.

#### Parameters

None

#### Returns

`string` - "zkCert storage cleared" on success.
Throws error otherwise.

#### Example

```javascript
await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: defaultSnapOrigin,
    request: {
      method: 'clearStorage',
    },
  },
});
```

### `importZkCert`

#### Description

Imports a zkCertificate from a file into the Snap. The file is created and signed by the provider and given to the user for being imported in the wallet.

Asks user for confirmation

#### Parameters

- `Object`
  - `zkCert` - JSON `object`, containing the zkCertificate data according to the standart it is using.

#### Returns

`string` "zkCert added to storage" on successful import.
Throws error otherwise.

#### Example

```javascript
await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: defaultSnapOrigin,
    request: {
      method: 'importZkCert',
      params: {
        zkCert: JSON.parse(fileContent),
      },
    },
  },
});
```

### `exportZkCert`

#### Description

Exports a zkCertificate stored in the snap.

Asks the user for confirmation and selection of the zkCertificate to be exported

#### Parameters

- `Object`
  - `zkCertStandard` - `string` identifying the standard of the zkCertificate to be exported.

#### Returns

- JSON `Object` of the zkCertificate according to the standard.

#### Example

```javascript
await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: defaultSnapOrigin,
    request: {
      method: 'exportZkCert',
      params,
    },
  },
});
```

### `listZkCerts`

#### Description

Requests overview of zkCertificates held in the Snap for management

To not limit the privacy risks of the user, this overview only contains zkCertificate metadata that is usually not shown in a ZKP. This should prevent cross referencing multiple disclosures submitted from different addresses.

Asks the user for confirmation. As a website you only need to query this once and then you can cache and reuse this data until the hash from the `getZkCertStorageHash` changes.

#### Parameters

None

#### Returns

- `Object`
  - `[zkCertStandard: string]`: JSON `object` holding zkCertificate metadata. - `provider` - JSON `object` including publickey of provider. - `expirationDate` - `number` Unix timestamp of expiration date.
    Throws an error if the user rejected the confirmation.

#### Example

```javascript
return await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: defaultSnapOrigin,
    request: {
      method: 'listZkCerts',
    },
  },
});
```

### `getZkCertStorageHashes`

#### Description

You can use `getZkCertStorageHash` to detect changes in the zkCert storage of the snap. This can be done without requiring user interaction (besides the initial connect) and therefore does not dirsturb the user flow.

#### Parameters

None

#### Returns

- `Object`
  - `[zkCertStandard: string]`: `string` for the storage hash of all zkCerts of this type held by the Snap.

#### Example

```javascript
let currentStorageHash = await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: defaultSnapOrigin,
    request: {
      method: 'getZkCertStorageHashes',
    },
  },
});
```
