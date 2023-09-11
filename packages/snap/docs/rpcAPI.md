# Galactica Snap JSON-RPC API

This page documents the JSON-RPC API of the Galactica Snap. It follows the structure for snap methods provided by Metamask ([https://docs.metamask.io/snaps/reference/rpc-api/#wallet_invokesnap](see here)).

To simplify the integration in front-end projects, we provide the NPM package [https://www.npmjs.com/package/@galactica-net/snap-api](@galactica-net/snap-api). It includes TypeScript methods, parameters and return types for the interaction.

## Connection Methods

### `wallet_requestSnaps`

Requests permission for a DApp to communicate with Metamask and the Galactica Snap.

Visit the [Metamask Documentation](https://docs.metamask.io/guide/snaps-rpc-api.html#wallet-requestsnaps) for more details.

#### Example

```javascript
const result = await ethereum.request({
  method: 'wallet_requestSnaps',
  params: {
    'npm:@galactica-net/snap': {},
  },
});

console.log(result);
// Will print something of the form:
// {
//   "npm:@galactica-net/snap": {
//     "blocked": false,
//     "enabled": true,
//     "id": "npm:@galactica-net/snap",
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
//     "permissionName": "wallet_snap_npm:@galactica-net/snap",
//     "version": "0.2.1"
//   }
// }
```

### `wallet_getSnaps`

#### Description

This method returns the IDs of the caller's permitted snaps and some relevant metadata.

See the [Metamask documentation](https://docs.metamask.io/guide/snaps-rpc-api.html#wallet-getsnaps) for more details.

## Galactica Specific Methods

All following methods are invoked through the `wallet_invokeSnap` method of the [Metamask RPC-API](https://docs.metamask.io/guide/snaps-rpc-api.html#wallet-invokesnap).

These methods are restricted, meaning that you first need to aquire permission using the connection method.

### `getHolderCommitment`

#### Description

Asks the Snap to return the holder commitment needed for issuing new zkCertificates.

#### Parameters

None

#### Returns

- `object`
  - `holderCommitment` - The holder commitment as decimal `string`.

Throws error if the user rejects the confirmation.

#### Example

```javascript
import { getHolderCommitment } from '@galactica-net/snap-api';
const holderCommitmentData = getHolderCommitment();
```

### `genZkKycProof`

#### Description

Sends a request for generating a ZK proof in the Snap. It is generic because you can request different kind of ZK proof depending on the parameters.

Shows the user what is going to be proven and asks for confirmation.

#### Parameters

- `object`
  - `input` - An `object`, containing public ZKP input for the statements to be shown by the generated proof.
  - `requirements` - `object`
    - `zkCertStandard`: `string` for the standard of the zkCertificate that should be used for the proof.
  - `prover` - `object` containing
    - `wasm` - `string` base64 encoded wasm binary of the prover. The wasm can be generated using circom and encoded with the script in `src/scripts/proofGenerationPrep.ts`.
    - `zkeyHeader` - `object` of zkey headers used by snarkjs. The binary fields are base64 encoded.
    - `zkeySections` - `array` of base64 encoded zkey sections used by snarkjs.
  - `userAddress` - `string` with the account address the user is going to use to submit the proof.
  - `disclosureDescription` - `string` (optional) Description of disclosures made by the proof.

#### Returns

Generated proof on accepted confirmation and successful computation.
Throws error otherwise.

- `object`
  - `proof` - `object`
    - `pi_a` - `object` holding proof verification data.
    - `pi_b` - `object` holding proof verification data.
    - `pi_c` - `object` holding proof verification data.
    - `protocol` - `string` Protocol used for ZKP, usually "groth16".
    - `curve` - `string` Curve used for ZKP, usually "bn128".
  - `publicSignals`: `array` List of public inputs for the proof as decimal strings.

#### Example

```javascript
import { getHolderCommitment } from '@galactica-net/snap-api';
// Requesting proof for zkKYC and age >= 18

// expected time for between pressing the generation button and the verification happening on-chain
const estimatedProofCreationDuration = 20;

const currentTimestamp =
  (await getCurrentBlockTime()) + stimatedProofCreationDuration;
const dateNow = new Date(currentTimestamp * 1000);

const proofInput = {
  currentTime: currentTimestamp,
  dAppAddress: '0xf1947AeD2d0a5Ff90D54b63C85904d258D3B5E63',
  investigationInstitutionPubKey: [], // fill with pubkeys if fraud investigation is needed
  currentYear: dateNow.getUTCFullYear().toString(),
  currentMonth: (dateNow.getUTCMonth() + 1).toString(),
  currentDay: dateNow.getUTCDate().toString(),
  ageThreshold: '18',
};

return await generateZKProof({
  input: proofInput,
  prover: await getProver('/provers/exampleMockDApp.json'),
  requirements: {
    zkCertStandard: ZkCertStandard.ZkKYC,
  },
  userAddress: getUserAddress(),
  disclosureDescription:
    'This proof discloses that you hold a valid zkKYC and that your age is at least 18. The proof includes 3 encrypted fragments for test institutions. 2 are needed to decrypt your zkKYC DID for fraud investigation.',
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

- `object`
  - `string` - "zkCert storage cleared" on success.
    Returns [an error](https://github.com/Galactica-corp/galactica-snap/blob/main/packages/snap-api/src/api/error.ts) otherwise.

#### Example

```javascript
import { getHolderCommitment } from '@galactica-net/snap-api';
await clearStorage();
```

### `importZkCert`

#### Description

Imports a zkCertificate from a file into the Snap. The file is created and signed by the provider and given to the user for being imported in the wallet.

Asks user for confirmation

#### Parameters

- `object`
  - `zkCert` - JSON `object`, containing the zkCertificate data according to the standart it is using.
  - `listZkCerts` - `boolean`, (optional) flag if the Snap should return an overview after the import, same as in the `listZkCerts` method.

#### Returns

- `object`
  - `string` "zkCert added to storage" on successful import.
    If `listZkCerts` is set to `true`, it returns the zkCert overview instead (same as in the `listZkCerts` method).
    Returns [an error](https://github.com/Galactica-corp/galactica-snap/blob/main/packages/snap-api/src/api/error.ts) if the import fails.

#### Example

```javascript
import { importZkCert } from '@galactica-net/snap-api';
await importZkCert({ zkCert: JSON.parse(fileContent) });
```

### `exportZkCert`

#### Description

Exports a zkCertificate stored in the snap.

Asks the user for confirmation and selection of the zkCertificate to be exported

#### Parameters

- `object`
  - `zkCertStandard` - `string` identifying the standard of the zkCertificate to be deleted (optional).
  - `expirationDate` - `number` identifying the expiration date of the zkCertificate to be deleted (optional).
  - `providerAx` - `string` identifying the provider pubkey (Ax part only) of the zkCertificate to be deleted (optional).

#### Returns

- JSON `object` of the zkCertificate according to the standard.

#### Example

```javascript
import { exportZkCert } from '@galactica-net/snap-api';
return await exportZkCert({ zkCertStandard: ZkCertStandard.ZkKYC });
```

### `deleteZkCert`

#### Description

Delete a zkCertificate stored in the snap.

You can provide some filter criteria which zkCert should be deleted based on the response from the `listZkCerts` method.
It asks the user for confirmation and selection of the zkCertificate to be deleted if the filter is ambiguous.

#### Parameters

- `object`
  - `zkCertStandard` - `string` identifying the standard of the zkCertificate to be deleted (optional).
  - `expirationDate` - `number` identifying the expiration date of the zkCertificate to be deleted (optional).
  - `providerAx` - `string` identifying the provider pubkey (Ax part only) of the zkCertificate to be deleted (optional).

#### Returns

- `object`
  - `string` - "Deleted zkCert." on success.
    Throws error otherwise.

#### Example

```javascript
import { deleteZkCert } from '@galactica-net/snap-api';
return await deleteZkCert({ zkCertStandard: ZkCertStandard.ZkKYC });
```

### `listZkCerts`

#### Description

Requests overview of zkCertificates held in the Snap for management

To not limit the privacy risks of the user, this overview only contains zkCertificate metadata that is usually not shown in a ZKP. This should prevent cross referencing multiple disclosures submitted from different addresses.

Asks the user for confirmation. As a website you only need to query this once and then you can cache and reuse this data until the hash from the `getZkCertStorageHash` changes.

#### Parameters

None

#### Returns

- `object`
  - `[zkCertStandard: string]`: JSON `object` holding zkCertificate metadata.
    - `provider` - JSON `object` including publickey of provider.
    - `expirationDate` - `number` Unix timestamp of expiration date.

Throws an error if the user rejected the confirmation.

#### Example

```javascript
import { listZkCerts } from '@galactica-net/snap-api';
return await listZkCerts();
```

### `getZkCertStorageHashes`

#### Description

You can use `getZkCertStorageHash` to detect changes in the zkCert storage of the snap. This can be done without requiring user interaction (besides the initial connect) and therefore does not dirsturb the user flow.

#### Parameters

None

#### Returns

- `object`
  - `[zkCertStandard: string]`: `string` for the storage hash of all zkCerts of this type held by the Snap.

#### Example

```javascript
import { getZkStorageHashes } from '@galactica-net/snap-api';
return await getZkStorageHashes();
```

### `getZkCertHashes`

#### Description

You can use `getZkCertHash` to query the leaf hashes of the zkCerts imported in the snap. This is needed for updating the Merkle proof. It is useful because it improves privacy by not using the same publicly trackable Merkle root.

However this function exposes the unique hash of zkCerts and should therefore only be on sites the user trusts to handle this ID confidentially.

#### Parameters

None

#### Returns

- `object`
  - `[string]` list of zkCert hashes of all zkCerts held by the Snap.

#### Example

```javascript
import { getZkCertHashes } from '@galactica-net/snap-api';
return await getZkCertHashes();
```

### `updateMerkleProof`

#### Description

This method updates the Merkle proof of a list of zkCerts. This is helpful to prevent tracking through the publicly disclosed merkle root.

You can create the Merkle proof with the scripts in the zkKYC repository.

#### Parameters

- `object`
  - `proofs: [MerkleProof]` list of MerkleProofs to update.

Each Merkle proof has the following [form defined in the zkKYC repository](https://github.com/Galactica-corp/zkKYC/blob/f3b92a5e18c2ef8e09143156ec8b54b677cc828c/lib/merkleTree.ts#L161).

#### Returns

- `object`
  - `string` - Success message.

Throws error on failure.

#### Example

```javascript
import { updateMerkleProof } from '@galactica-net/snap-api';
await updateMerkleProof({
  proofs: [
    {
      leaf: '19630604862894493237865119507631642105595355222686969752403793856928034143008',
      root: '17763126929763058632596384403463503447502390993612973244727217445899815879260',
      pathIndices: 0,
      pathElements: [
        '913338630289763938167212770624253461411251029088142596559861590717003723041',
        '8950197483297962010688249615565850791722784770941154749153756652440041255541',
        '9917272083296999008482951374949279205405409343140430270441153151503507424016',
        '17619695615639375563172755451063681091123583187367666354590446695851847455206',
        '13318301576191812234266801152872599855532005448246358193934877587650370582600',
        '14788131755920683191475597296843560484793002846324723605628318076973413387512',
        '15889843854411046052299062847446330225099449301489575711833732034292400193334',
        '4591007468089219776529077618683677913362369124318235794006853887662826724179',
        '974323504448759598753817959892943900419910101515018723175898332400800338902',
        '10904304838309847003348248867595510063038089908778911273415397184640076197695',
        '6882370933298714404012187108159138675240847601805332407879606734117764964844',
        '5139203521709906739945343849817745409005203282448907255220261470507345543242',
        '13660695785273441286119313134036776607743178109514008645018277634263858765331',
        '10348593108579908024969691262542999418313940238885641489955258549772405516797',
        '8081407491543416388951354446505389320018136283676956639992756527902136320118',
        '9958479516685283258442625520693909575742244739421083147206991947039775937697',
        '7970914938810054068245748769054430181949287449180056729094980613243958329268',
        '9181633618293215208937072826349181607144232385752050143517655282584371194792',
        '4290316886726748791387171617200449726541205208559598579274245616939964852707',
        '6485208140905921389448627555662227594654261284121222408680793672083214472411',
        '9758704411889015808755428886859795217744955029900206776077230470192243862856',
        '2597152473563104183458372080692537737210460471555518794564105235328153976766',
        '3463902188850558154963157993736984386286482462591640080583231993828223756729',
        '4803991292849258082632334882589144741536815660863591403881043248209683263881',
        '8436762241999885378816022437653918688617421907409515804233361706830437806851',
        '1050020814711080606631372470935794540279414038427561141553730851484495104713',
        '12563171857359400454610578260497195051079576349004486989747715063846486865999',
        '15261846589675849940851399933657833195422666255877532937593219476893366898506',
        '3948769100977277285624942212173034288901374055746067204399375431934078652233',
        '5165855438174057791629208268983865460579098662614463291265268210129645045606',
        '19766134122896885292208434174127396131016457922757580293859872286777805319620',
        '21875366546070094216708763840902654314815506651483888537622737430893403929600',
      ],
    },
  ],
});
```
