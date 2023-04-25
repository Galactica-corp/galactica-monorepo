# Galactica Front End Guide

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
