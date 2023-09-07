# Galactica ZK Vault

The Galactica ZK Vault adds Galactica Network features to Metamask. It holds zero-knowledge certificates (zkCerts) in self custody and allows generating zero-knowledge proofs for selective disclosures. This provides compliance with maximum privacy.

The implementation can be found on [GitHub](https://github.com/Galactica-corp/galactica-snap/tree/main/packages/snap).

Snaps are plugins for Metamask. Currently they are a pre-release feature only available in [Metamask Flask](https://metamask.io/flask/).

More context on Galactica can be found here: https://galactica.com/

## Features

- Self custody for zero-knowledge certificates, such as zkKYC or other self sovereign identity (SSI) documents.
- Generation of zero-knowledge proofs on your local machine for compliance, selective disclosures and reputation proofs.
- Deriving a zero-knowledge compatible signing and encryption keys from a usual Metamask wallet.
- Integration in the popular Metamask wallet for using Galactica Network just as any other EVM compatible blockchain.

## Installation

1. Install the Metamask Flask browser extension (Development version of Metamask): https://metamask.io/flask/
2. Import the wallets you are going to use in Metamask.
3. Go to any website that provides Galactica services, such as [passport.galactica.com](https://passport.galactica.com). TODO: confirm URL
4. Connect to Metamask. This will check that you have the current Galactica Snap installed. It is identified with the name of this package on NPM [npm:@galactica-net/snap](https://www.npmjs.com/package/@galactica-net/snap).
5. If the Galactica Snap needs to be (re-)installed, Metamask will ask you to accept the permissions used by the Snap, similar to how app permissions work on Android and iOS.
6. If it was not done by the website automatically, add the Galactica Network in Metamask with the following parameters: TODO

## Getting started

### As a user

Visit the [Galactica Passport site](https://passport.galactica.com) TODO: confirm URL

It will guide you through the process of creating your first zkKYC. With it, you can prove and claim your Galactica citizenship on-chain.

In general, the following steps are performed by a user:

1. _Setup zkCert holder:_ Initializes the keys for holding zkCertificates from a signature by your Metamask wallet. It is required for efficient signing and encryption in zero-knowledge proof generation.
2. _Export holder commitment:_ Creates a commitment that you send to a zkCert provider for issuing a zkCert on-chain. It is used to tie the zkCert to your holder wallet without disclosing this connection to anyone.
3. _Import zkCertificate:_ After a provider has created and issued a zkCert for you, it can be imported in your wallet.
4. _Proof generation:_ To utilize a zkCert, the Galactica Snap can create various zero knowledge proofs. In the process, the Snap informs about the selective disclosures you are going to make publicly and generates the proof. This proof can then be sent by the front-end in a usual smart contract transaction through Metamask.

### As a developer

To integrate the Galactica snap on a web front-end by using the snapId `npm:@galactica-net/snap` in the [requestSnaps call](https://docs.metamask.io/guide/snaps-rpc-api.html#unrestricted-methods).

RPC functions specific to the Galactica Snap can be found in the [JSON RPC API](docs/rpcAPI.md).

You can also take a look at the example front-end DApp located in [packages/galactica-dapp](../galactica-dapp/).

If you want to publish beta versions, those need to go to another NPM package so that users can continue to use the stable version in the meantime. Therefore, you can find beta versions here: `npm:@galactica-net/snap-beta`
