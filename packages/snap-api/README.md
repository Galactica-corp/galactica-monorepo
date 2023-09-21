# Galactica Snap API for front-ends

This API package provides easy to use methods, types and errors for interacting with the Galactica ZK Vault Snap. It simplifies writing a front-end of Galactica DApps that require the user to create zero-knowledge proofs for compliant privacy.

Basically this API is a TypeScript wrapper for the JSON RPC API of the snap as defined in the [docs](https://docs.galactica.com/galactica-developer-documentation/building-a-galactica-dapp/front-end/galactica-snap-json-rpc-api).

## Usage

To use this package, you can add `"@galactica-net/snap-api"` with the latest version number on [NPM](https://www.npmjs.com/package/@galactica-net/snap-api) to the dependencies in `package.json`.

Then you can import and use the types and methods to interact with the Galactica Snap. You can find examples [here](https://docs.galactica.com/galactica-developer-documentation/building-a-galactica-dapp/front-end/guided-example) in the documentation.

## How to build (for developers of this package)

This package needs to be built before changes in it are available to other packages depending on it.

```
yarn build
```

Afterwards it can be published to NPM.

```
yarn npm login
yarn npm publish
```
