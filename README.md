# Galactica Monorepo

Galactica Network monorepo including zero-knowledge certificates, the Galactica ZK Vault Snap for Metamask and front-end examples.

## Galactica ZK Vault Snap

The the README in `pagages/snap` for more details.

This package provides a Metamaks Snap for Galactica Network.
It adds Galactica specific features, such as

- Self custody wallet for zero knowledge certificates (zkCerts) providing self sovereign identity
- Generating zero knowledge proofs for selective disclosures (combining compliance with privacy).
  You can find the snap package [here](packages/snap/). General documentation on Metamask Snaps can be found [here](https://docs.metamask.io/snaps/how-to/develop-a-snap/#table-of-contents).

Furthermore the repository includes front-ends demonstrating how to interact with the Galactica Snap to build a DApp or management portal:

- [galactica-dapp](packages/galactica-dapp/): simple front-end to connect, generate and submit zero knowledge proofs and check completed verifications
- [galactica-passport-poc](packages/galactica-passport-poc/): full demo for zkCert setup, management and proof generation

For more information, visit https://galactica.com/

### Snaps is pre-release software

To interact with the Galactica Snap, you will need to install [MetaMask Flask](https://metamask.io/flask/), a canary distribution for developers that provides access to upcoming features.

## Getting Started

```shell
yarn install
yarn start
```

## Proof preparation

To generate zk proofs, the snap takes the generator wasm and keys as input. This data is preliminarily provided through uploading a json file to the Snap.
It can be generated with the script `packages/snap/scripts/proofGenerationPrep.ts` that takes the circut name, test input and the circom build folder as input.

```shell
cd packages/snap
yarn run proofPrep --circuitName <name> --circuitsDir <path> --testInput <path>
```

You can modify the script to select another proof to prepare.

## Usage

1. Open http://localhost:8001/
2. Connect to Metamask Flask. This also installs the Snap. (redo after compiling a new Snap version)
3. Setup holder account and connect Snap to Metamask wallet
4. Export holder commitment
5. Create zkKYC from holder commitment and personal data with zkKYC repo task `npx hardhat createZkKYC`
6. Add Merkle tree proof form `npx hardhat run scripts/merkleTreeGenerator.ts` to zkKYC json
7. Import zkKYC certificate in Snap
8. Generate zkKYC + age proof

## Contributing

### Testing and Linting

Run `yarn test` to run the tests once.
Please note that the Snap test generates and verifies an ageProofZkKYC. Therefore it requires having the prover files in `packages/site/public/provers/`. If they are missing you can add them using the `proofGenerationPrep.ts` script as explained above.

Run `yarn lint` to run the linter, or run `yarn lint:fix` to run the linter and fix any automatically fixable issues.
