# zkKYC

Repository for Galactica Network's zero-knowledge Know Your Customer (zkKYC) solution.

ZkKYC is a solution concept for meeting KYC obligations while preserving user privacy. It utilizes zero-knowledge cryptography to prove statements without sharing any personal details. For example users can prove that they have passed KYC and are grown up without disclosing personal details, such as names or birthdays.

This repo contains

- Library of ZK circuits
- Smart contracts for on-chain storage of zkKYCs and verification
- Library of tools and scripts for building, creating, issuing and querying zkKYCs

The project is based on:

- hardhat for Solidity development
- Circom for the zero knowledge part to write SNARK circuits
- SnarkJS for creating zk proofs

The documentation can be found [here](https://app.gitbook.com/o/IbmhhVJSM8rZ0aECe2R3/s/NMoORBGBxztthVlosoIF/galactica-concepts/zero-knowledge-kyc).

## Install

```shell
yarn install
```

## Compile

This repo contains several parts that can be compiled:

1. The zero-knowledge circuits
2. The smart contracts
3. The typescript library functions

### Circuits

To compile the circuits, you first need the parameters from the trusted setup ceremony. It is the basis for keeping the computation in the ZKPs private.
You can download it from [here](https://galactica.com/trusted-setup/dev/pot17_final.ptau) and place it in the `circuits` folder.

The following hardhat task takes care of compiling the circuits, testing it with available input files and postprocessing the output.

```shell
wget https://galactica.com/trusted-setup/dev/pot17_final.ptau -O circuits/pot17_final.ptau
yarn hardhat smartCircuitBuild --verbose
```

It only rebuilds the circuits for which the source changed since the last build.

If the circuits were changed, the compilation requires a valid input file for the circuit. They can be found in `circuits/input/`. They can be modified by hand. For complex circuits using hashes, such as zkKYC, you can use the `yarn hardhat run scripts/writeExampleZKKYCInputs.ts` to generate the file inlcuding hashes and merkle tree data.

### Smart Contracts

The simplest way to compile the smart contracts is to run the tests. This automatically compiles them.

```shell
yarn test
```

### Library functions

The library functions only need to be compiled if you want to publish them to NPM or make it available to some other JavaScript project. Usually, this can be skipped because you can run scripts with `yarn hardhat run <file>`.

To compile the library functions into a node module, you can run:

```shell
yarn build
```

## Test

Run unit and integration tests for circuits, library functions and smart contracts.

```shell
yarn hardhat smartCircuitBuild --verbose
yarn run test
```

## Deploy

There are some scripts for deployment of the basic infrastructure and example dApps.
Before running it, you need to configure the deployer wallet in the environment variables used in `hardhat.config.ts` adn fund the account.

```shell
yarn hardhat run scripts/prepare-poseidon.ts
yarn hardhat ignition deploy ignition/modules/CompleteTestSetup.m.ts --network cassiopeia
yarn hardhat ignition deploy ignition/modules/TwitterProofs.m.ts --network cassiopeia
```

## Create and issue zkCertificates

First collect the certificate data and holder commitment from the user. For example as in [the zkKYC example](example/kycFields.json).
Then you can sign it using the following hardhat task (replace holder commitment and file)

```shell
yarn hardhat createZkCertificate --holder-file example/holderCommitment.json --kyc-data-file example/test.json --registry-address 0xD95efF72F06079DEcE33b18B165fc3A7a4bdc1fD --expiration-date 2344658820 --network reticulum
```

The task issues the resulting zkCert on-chain and provides a merkle proof for it.
Then you can send the zkCert data to the user, so that he/she can create zk proofs with it.

## Publish this repo on npm

First make sure that the tests run successfully

```shell
yarn test
```

Build code into js files and publish it on NPM

```shell
yarn build
yarn npm login
yarn npm publish
```

Create a new release version on GitHub [here](https://github.com/Galactica-corp/zkKYC/releases/new).

## ZK Ceremony

ZK circuits written in this repo need to go through a phase 2 trusted ceremony before usage in production.
You can use the p0tion and DefinitelySetup instance hosted by Galactica.
The ceremony can be created by the coordinator using the `phase2cli` tool.
Contributions are possible through the `phase2cli` tool on the command line or on the DefinitelySetup front-end.

Ceremony results can be downloaded and integrated in this repo using the following command. You can lookup the `<CEREMONY-ID>` on DefinitelySetup or through `phase2cli list`

```shell
yarn hardhat integrateCeremonyResults --ceremony-id <CEREMONY-ID>
```

Now you can run tests and deploy the verifier contracts.

Note that the smartCircuitBuild used by `yarn build` and `yarn test` will overwrite the ceremony results if it detects newer or modified circom code. So better run it before.

To make the prover available to the snap, you still need to run

```shell
cd ../snap
yarn proofPrep  --circuitName <CIRCUIT_NAME>
```
