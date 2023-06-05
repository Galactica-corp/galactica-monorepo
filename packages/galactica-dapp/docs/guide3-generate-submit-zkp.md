# Galactica Front End Guide

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
const proverText = await fetch('/provers/ageProofZkKYC.json');
const parsedFile = JSON.parse(await proverText.text());

const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

// fetch institution pubkey from chain because it is needed as proof input
const institutionContract = new ethers.Contract(
  addresses.galacticaInstitution,
  galacticaInstitutionABI.abi,
  signer,
);
const institutionPubKey: [string, string] = [
  BigNumber.from(await institutionContract.institutionPubKey(0)).toString(),
  BigNumber.from(await institutionContract.institutionPubKey(1)).toString(),
];

const res: any = await generateProof(
  parsedFile,
  addresses.mockDApp,
  institutionPubKey,
);
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
const exampleDAppSC = new ethers.Contract(
  addresses.mockDApp,
  mockDAppABI.abi,
  signer,
);

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
