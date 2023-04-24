# Galactica Front End Guide

## Prepare ZK proof generation

Before the user can create a ZK proof, the following parts need to be prepared.
Some of it can be skipped if the user has already completed a verification. This can be checked by querying verification soul-bound-tokens from the blockchain (see the section on "Handle Verification SBTs").

### Preparation on user side
The user needs to hold zkCerts in the wallet before they can be used in a proof. For zkKYC, the user can go to the Galactica passport portal. Here they can find a KYC provider, get the zkKYC issued and import it in the Galactica Snap.

Other kinds of zkCerts that are not managed by by the passport portal yet, can also be imported through the open [JSON RPC API](../../snap/docs/rpcAPI.md).

### Preparation on developer side
ZkCerts can be utilized to prove a wide range of statements. The Galactica Snap provides a generalized prove method that can be parameterized for the ZK proof that you need.

First you need to decide what kind of statements the users of your DApp should proof to be able to use it:
- Galactica provides common use cases, such as a zkKYC and zkKYC+age proof TODO: link docs with overview what these proofs contain. For these common proofs, you might be able to reuse an already completed verification (See the section on "Handle Verification SBTs"). Specifications for standardization can be found as Galactica improvement proposals. TODO: link
- Custom ZK statements can be proven by building a ZK circuit for it using the [circom2](https://docs.circom.io/) framework. You can find various component templates in the Galactica ZK circuit library to build upon. TODO: link

According to the kind of statement the user is going to prove we need to provide the following parameters to the Galactica Snap:
```typescript
/**
 * Parameter for requests to generate a zkKYC proof.
 */
export type GenZkKycRequestParams<ProofInputType> = {
  // proof inputs that are passed in addition to the zkCert data
  // Which of these become public proof inputs is defined in the ZK circuit, which is compiled into the WASM.
  input: ProofInputType;
  requirements: ZkCertRequirements;

  // Prover code in web assembly that will be used to generate the proof in the Snap.
  wasm: any;
  // Corresponding parameters from the zkey file (SNARK trusted setup ceremony).
  zkeyHeader: any;
  zkeySections: any[];
};

// requirements on the type of zkCert that is used as proof input
export type ZkCertRequirements = {
  // identifier of the zkCert standard (e.g. gip69 for zkKYC)
  zkCertStandard: string;
};
``` 

`input` and `requirements` are derived from the ZK circuit you use and the type of zkCert it requires as input.

`wasm`, `zkeyHeader` and `zkeySections` hold the prover and cryptographic setup. These are not in the usual circom format, because they have to be passed in JSON through the RPC API and because of restrictions in the secure Snap execution environment. A JSON data file including these fields can be generated from the circom output using the following script. It also takes a test Input file to check that the prover works correctly.

```shell
cd packages/snap
yarn run proofPrep --circuitName <name> --circuitsDir <path> --testInput <path>
```

This generates the file `packages/galactica-dapp/public/provers/<name>.json` which can be imported in the frontend to get the `wasm`, `zkeyHeader` and `zkeySections` we need.

Please note that, depending on the type of proof, the file can get quite large. For an zkKYC+age proof, the file is `31MB` large.

For the example, the prover JSON file is already provided for simplicity, so you do not have to compile the circom circuit first.

For writing and compiling your own circuit, more instructions can be found in the [zkKYC repository](https://github.com/Galactica-corp/zkKYC).
