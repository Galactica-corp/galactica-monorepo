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
npm install
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
npx hardhat smartCircuitBuild --verbose
```
It only rebuilds the circuits for which the source changed since the last build.

If the circuits were changed, the compilation requires a valid input file for the circuit. They can be found in `circuits/input/`. They can be modified by hand. For complex circuits using hashes, such as zkKYC, you can use the `npx hardhat run scripts/writeExampleZKKYCInputs.ts` to generate the file inlcuding hashes and merkle tree data.

### Smart Contracts
The simplest way to compile the smart contracts is to run the tests. This automatically compiles them.
```shell
npm run test
```

### Library functions
The libary functions only need to be compiled if you want to publish them to NPM or make it available to some other JavaScript project. Usually, this can be skipped because you can run scripts with `npx hardhat run <file>`.

To compile the library functions into a node module, you can run:
```shell
npm run build
```

## Test
Run unit and integration tests for circuits, library functions and smart contracts.
```shell
npx hardhat smartCircuitBuild --verbose
npm run test
```

## Deploy
There are some scripts for deployment of the basic infrastructure and example dApps.
Before running it, you need to configure the deployer wallet in the environment variables used in `hardhat.config.ts` adn fund the account.
```shell
npx hardhat run scripts/deployInfrastructure.ts --network galaTestnet
```
You can find the addresses of the deployed contracts in the console output.
If you also want to deploy example contracts, you can enter them in the following script before running it.
```shell
npx hardhat run scripts/deployExampleDApp.ts --network galaTestnet
```

## Create and issue zkCertificates
First collect the certificate data and holder commitment from the user. For example as in [the zkKYC example](example/kycFields.json).
Then you can sign it using the following hardhat task (replace holder commitment and file)
```shell
npx hardhat createZkKYC --holder-commitment 839160718446872147271060736034559178228117322331346628862983451058562783963 --kyc-data-file example/test.json --random-salt 1773 --registry-address 0x855d8DeF49d550df733Afb848aC723AEEBa58adF --network galaTestnet
```
The task issues the resulting zkCert on-chain and provides a merkle proof for it.
Then you can send the zkCert data to the user, so that he/she can create zk proofs with it.

## Publish this repo on npm
First make sure that the tests run successfully
```shell 
npm run test
```

Build code into js files and publish it on NPM
```shell
npm run build
npm publish
```

Create a new release version on GitHub [here](https://github.com/Galactica-corp/zkKYC/releases/new).
