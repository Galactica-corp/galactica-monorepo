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
const defaultSnapOrigin = "npm:@galactica-corp/snap";

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

    return Object.values(snaps).find(
      (snap) => snap.id === defaultSnapOrigin,
    );
  } catch (error) {
    console.log('Failed to obtain installed snap', error);
    return undefined;
  }
};
``` 

Now you should be able to use [Galactica specific functions](../../snap/docs/rpcAPI.md) through the snap using the [wallet_invokeSnap method](https://docs.metamask.io/snaps/reference/rpc-api#wallet_invokesnap). 
See the next page for an example

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


## Generate and submit ZK proof

With the preparations done, the front-end code calling for the generation can be implemented:

```typescript
/**
 * GenerateProof prepares and executes the call to generate a ZKP in the Galactica snap.
 *
 * @param proverData - Prover data passed to the snap (including wasm and zkey).
 * @param dAppAddress - Contract address to send the ZKP to.
 * @param investigationInstitutionPubKey - Public key of the institution that can investigate the ZKP.
 * @returns Request result that should contain the ZKP.
 */
export const generateProof = async (
  proverData: any,
  dAppAddress: string,
  investigationInstitutionPubKey: [string, string],
) => {
  // Because the proof checks the expiration time, we estimate the time when the proof will be validated on-chain
  const estimatedProofCreationDuration = 20;
  const expectedValidationTimestamp =
    (await getCurrentBlockTime()) + estimatedProofCreationDuration;
  const dateNow = new Date(expectedValidationTimestamp * 1000);

  const proofInput: ZkKYCAgeProofInput = {
    // general zkKYC inputs
    currentTime: expectedValidationTimestamp,
    dAppAddress,
    investigationInstitutionPubKey,
    // the zkKYC itself is not needed here. It is filled by the snap for user privacy.

    // specific inputs to prove that the holder is at least 18 years old
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
          input: proofInput,
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
};
```

On the users request, this function can be called and filled with parameters like this:
```typescript
// get prover data (separately loaded because the large json should not slow down initial site loading)
const proverText = await fetch("/provers/ageProofZkKYC.json");
const parsedFile = JSON.parse(await proverText.text());

const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

// fetch institution pubkey from chain because it is needed as proof input
const institutionContract = new ethers.Contract(addresses.galacticaInstitution, galacticaInstitutionABI.abi, signer);
const institutionPubKey: [string, string] = [
  BigNumber.from(await institutionContract.institutionPubKey(0)).toString(),
  BigNumber.from(await institutionContract.institutionPubKey(1)).toString(),
];

const res: any = await generateProof(parsedFile, addresses.mockDApp, institutionPubKey);
```

This sends the proof request to the Galactica Snap. The user can view what data is disclosed by the proof and accept or reject it. The generation is automatically rejected, if the user has not setup and imported a matching zkCert, in this example a `gip69` zkKYC.

If the request fails, it throws an error. It might also happen that the prover is unable to find a proof for the given input. The error then contains a backtrace to the Circom component that fails to satisfy an assertion. This component can give a hint on what condition fails. This could be for example:
- Incorrect inputs
- The user is less than 18 years old, according to the zkKYC.
- Input values having the wrong format. Be careful when converting between Circom field elements and EVM variables.

Circom returns values in decimal form and we need to convert them into hex numbers before sending them in an EVM transaction:

```typescript
// this function convert the proof output from snarkjs to parameter format for onchain solidity verifier
export function processProof(proof: any) {
  const piA = proof.pi_a
    .slice(0, 2)
    .map((value: any) => fromDecToHex(value, true));
  // for some reason the order of coordinate is reverse
  const piB = [
    [proof.pi_b[0][1], proof.pi_b[0][0]].map((value) =>
      fromDecToHex(value, true),
    ),
    [proof.pi_b[1][1], proof.pi_b[1][0]].map((value) =>
      fromDecToHex(value, true),
    ),
  ];

  const piC = proof.pi_c
    .slice(0, 2)
    .map((value: any) => fromDecToHex(value, true));
  return [piA, piB, piC];
}

// this function processes the public inputs
export function processPublicSignals(publicSignals: any) {
  return publicSignals.map((value: any) => fromDecToHex(value, true));
}
``` 

To simplify the user flow, we recommend to directly submit the proof after it has been generated:
```typescript
// get contract to send proof to
const exampleDAppSC = new ethers.Contract(addresses.mockDApp, mockDAppABI.abi, signer);

// 
let [a, b, c] = processProof(res.proof);
let publicInputs = processPublicSignals(res.publicSignals);

// this is the on-chain function that requires a ZKP
let tx = await exampleDAppSC.airdropToken(1, a, b, c, publicInputs);
const receipt = await tx.wait();
``` 

On success, most smart contracts mint a verification soul-bound token (SBT) for the user. These usually unlock using the smart contract until the SBT expires. So users do not have to spend time generating a ZKP for every transaction.

The on-chain verification can also fail. The error often reveals which requirement failed. If the verification of the ZKP fails, make sure to check the following:
- Is the prover (wasm and zkey) compatible with the verifier in the smart contract? Both are generated from the circom compilation and need to match.
- Is the timing correct? ZKPs containing the current time have a validity limit.

## Handle Verification SBTs

You can lookup on-chain if a user already holds a verification soul-bound token (SBT) from a previous ZKP he/she submitted.
Verification SBTs are minted by smart contracts after successful verification and contains an expiration date and details about the addresses, contracts and institutions involved.

Verification SBTs can also include the user's dApp specific human ID. It is a unique identifier hash derived from a DApp address and personal details in the zkKYC (name, birthday, passport ID). It can be used for human centric voting and reputation across multiple wallets of the user. Because it also depends on the DApp address the user can prevent cross referencing it with other verification SBTs by using carefully separated wallets.

The verification SBT of a specific wallet and DApp combination can be obtained in this way:
```typescript
const sbtContract = new ethers.Contract(
  sbtContractAddr,
  VerificationSbtABI.abi,
  provider,
);
const sbtInfo = await sbtContract.getVerificationSBTInfo(
  loggedUser,
  loggedDApp,
);
```

Alternatively, if you want to find all verification SBTs of a user or a DApp, you can search through the event log using the following filter:
```typescript
// go through all logs adding a verification SBT for the user
const filter = {
  address: sbtContractAddr,
  topics: [
    ethers.utils.id('VerificationSBTMinted(address,address,bytes32)'),
    dAppAddr ? ethers.utils.hexZeroPad(dAppAddr, 32) : null,
    userAddr ? ethers.utils.hexZeroPad(userAddr, 32) : null,
    humanID ? ethers.utils.hexZeroPad(humanID, 32) : null,
  ],
};

const createStakeLogs = await sbtContract.queryFilter(
  filter as EventFilter,
  0,
  currentBlock,
);
``` 
Because most RPC endpoints limit the range of blocks to find logs, we provided a search function that loops through the history and caches results to make following queries faster. You can find it [here](https://github.com/Galactica-corp/galactica-snap/blob/ceda66ed60c6249a6239e1b789dc38a9344037d5/packages/site/src/utils/zkCertTools.ts#L59).
