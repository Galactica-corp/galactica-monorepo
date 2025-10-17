# Blum Certificate ZK Proofs Implementation

## Task Description

Create ZK proofs for the new Blum certificate standard (GIP-8) to enable privacy-preserving verification of Telegram account activity and sybil resistance scores. The Blum certificate (defined in `packages/galactica-types/schema/certificate_content/blum.json`) contains three fields: `telegramId`, `activityScore`, and `sybilScore` (both scores are floats with 18 decimal precision).

## Context

- GIP-8 certificate standard already created in PR #130
- Registry contracts deployed via `packages/zk-certificates/ignition/modules/zkCertRegistries/GIP8.m.ts`
- Similar implementation pattern exists for Twitter certificates
- Target deployment: Cassiopeia testnet

## Implementation Plan

### 1. Certificate Issuance Support

**File**: `packages/zk-certificates/tasks/createZkCertificate.ts`

- Should supports issuing Blum certificates

### 2. ZK Circuit Development

#### 2a. Base Blum Certificate Circuit

**File**: `packages/zk-certificates/circuits/blumZkCertificate.circom`

- Pattern: Copy from `twitterZkCertificate.circom`
- Template: `BlumZkCertificate(levels, maxExpirationLengthDays)`
- Content hash: `Poseidon(3)` for telegramId, activityScore, sybilScore (alphabetical order)
- Includes: ownership, authorization, provider signature, merkle proof, expiration checks

**File**: `packages/zk-certificates/circuits/mains/blumZkCertificate.main.circom`

```circom
pragma circom 2.2.2;
include "../blumZkCertificate.circom";
component main {public [root, currentTime, userAddress, providerAx, providerAy]} = BlumZkCertificate(32, 60);
```

#### 2b. Score Sum Proof Circuit

**File**: `packages/zk-certificates/circuits/blumScoreSumProof.circom`

- Template: `BlumScoreSumProof(levels, maxExpirationLengthDays)`
- Additional inputs: `scoreSumThreshold` (public input)
- Logic: Check that `activityScore + sybilScore >= scoreSumThreshold`
- Use `GreaterEqThan(128)` component for comparison
- Pattern: Similar to `twitterFollowersCountProof.circom`

**File**: `packages/zk-certificates/circuits/mains/blumScoreSumProof.main.circom`

```circom
component main {public [root, currentTime, userAddress, providerAx, providerAy, scoreSumThreshold]} = BlumScoreSumProof(32, 60);
```

#### 2c. Score Thresholds Proof Circuit

**File**: `packages/zk-certificates/circuits/blumScoreThresholdsProof.circom`

- Template: `BlumScoreThresholdsProof(levels, maxExpirationLengthDays)`
- Additional inputs: `activityScoreThreshold`, `sybilScoreThreshold` (both public)
- Logic: Check `activityScore >= activityScoreThreshold AND sybilScore >= sybilScoreThreshold`
- Use two `GreaterEqThan(128)` components + `AND` gate

**File**: `packages/zk-certificates/circuits/mains/blumScoreThresholdsProof.main.circom`

```circom
component main {public [root, currentTime, userAddress, providerAx, providerAy, activityScoreThreshold, sybilScoreThreshold]} = BlumScoreThresholdsProof(32, 60);
```

#### 2d. Circuit Configuration

**File**: `packages/zk-certificates/hardhat.config.ts`

Add to `circuits` array (around line 274):

```typescript
{
  name: 'blumZkCertificate',
  circuit: 'mains/blumZkCertificate.main.circom',
  input: 'input/blumZkCertificate.json',
},
{
  name: 'blumScoreSumProof',
  circuit: 'mains/blumScoreSumProof.main.circom',
  input: 'input/blumScoreSumProof.json',
},
{
  name: 'blumScoreThresholdsProof',
  circuit: 'mains/blumScoreThresholdsProof.main.circom',
  input: 'input/blumScoreThresholdsProof.json',
}
```

### 3. Test Input Generation

**File**: `packages/zk-certificates/scripts/dev/generateBlumZkCertificateInput.ts`

- Pattern: Copy from `generateTwitterZkCertificateInput.ts`
- Functions: `generateSampleBlumZkCertificate()`, `generateBlumZkCertificateProofInput()`
- Use example data from `example/blumFields.json`
- Scores must be represented as 18-decimal fixed-point integers in circuit inputs

**Files**: Circuit input JSONs

- `packages/zk-certificates/circuits/input/blumZkCertificate.json`
- `packages/zk-certificates/circuits/input/blumScoreSumProof.json` (add `scoreSumThreshold`)
- `packages/zk-certificates/circuits/input/blumScoreThresholdsProof.json` (add both thresholds)

### 4. Circuit Unit Tests

**File**: `packages/zk-certificates/test/circuits/blumScoreSumProof.ts`

- Pattern: Copy from `twitterFollowersCountProof.ts` (circuit test)
- Test valid proof generation
- Test witness values
- Test threshold boundary conditions

**File**: `packages/zk-certificates/test/circuits/blumScoreThresholdsProof.ts`

- Similar structure for dual-threshold proof
- Test both thresholds independently and combined

### 5. Smart Contract Verifier Wrappers

#### 5a. Score Sum Verifier Wrapper

**File**: `packages/zk-certificates/contracts/verifierWrappers/BlumScoreSumProof.sol`

- Pattern: Copy from `TwitterFollowersCountProof.sol`
- Public input indices: IS_VALID, VERIFICATION_EXPIRATION, ROOT, CURRENT_TIME, USER_ADDRESS, PROVIDER_PUBKEY_AX, PROVIDER_PUBKEY_AY, SCORE_SUM_THRESHOLD
- Constructor: takes owner, verifier, registry addresses
- `verifyProof()`: validates merkle root, timestamp, user authorization

#### 5b. Score Thresholds Verifier Wrapper

**File**: `packages/zk-certificates/contracts/verifierWrappers/BlumScoreThresholdsProof.sol`

- Similar to above but with: ACTIVITY_SCORE_THRESHOLD, SYBIL_SCORE_THRESHOLD
- Public inputs length: 9 (adds one more threshold)

#### 5c. Interface

**File**: `packages/zk-certificates/contracts/interfaces/IBlumZkCertificateVerifier.sol`

- Pattern: Copy from `ITwitterZkCertificateVerifier.sol`
- Define verifier wrapper interface with INDEX getters

### 6. DApp Contracts

**File**: `packages/zk-certificates/contracts/dapps/BlumRequirementsDemoDApp.sol`

- Pattern: Similar to `TwitterRequirementsDemoDApp.sol`
- Creates VerificationSBT in constructor
- `checkRequirements()`: validates proof and mints SBT
- Single contract accepting IBlumZkCertificateVerifier (configurable)

**File**: `packages/zk-certificates/contracts/dapps/BlumScoreSumProverDApp.sol`

```solidity
contract BlumScoreSumProverDApp is BlumRequirementsDemoDApp {
    constructor(IBlumZkCertificateVerifier _verifierWrapper, ...) 
        BlumRequirementsDemoDApp(_verifierWrapper, ...) {}
}
```

**File**: `packages/zk-certificates/contracts/dapps/BlumScoreThresholdsProverDApp.sol`

- Similar inheritance pattern

### 7. Ignition Deployment Module

**File**: `packages/zk-certificates/ignition/modules/BlumProofs.m.ts`

- Pattern: Similar to `KYCComplianceProofs.m.ts`
- Import GIP8 registry: `gip8ZkCertRegistryModule`
- Deploy verifiers: `BlumScoreSumProofVerifier`, `BlumScoreThresholdsProofVerifier`
- Deploy wrappers: `BlumScoreSumProof`, `BlumScoreThresholdsProof` (configurable thresholds via parameters)
- Deploy DApps: `BlumScoreSumProverDApp`, `BlumScoreThresholdsProverDApp` with SBT metadata
- SBT defaults:
  - Score Sum SBT: name "Blum Score Sum Verification", symbol "BLUMSUM"
  - Score Thresholds SBT: name "Blum Score Thresholds Verification", symbol "BLUMTH"

### 8. Contract Integration Tests

**File**: `packages/zk-certificates/test/contracts/blumScoreSumProof.ts`

- Pattern: Copy from `twitterFollowersCountProof.ts` (contract test)
- Test complete flow:

  1. Deploy MockZkCertificateRegistry
  2. Deploy verifier and wrapper
  3. Generate Blum certificate
  4. Generate proof with snarkjs
  5. Verify on-chain
  6. Test invalid proofs (wrong threshold, expired cert, unauthorized user)

**File**: `packages/zk-certificates/test/contracts/blumScoreThresholdsProof.ts`

- Similar integration tests for dual-threshold proof

### 9. Example Certificate

**File**: `test/blumCert.json`

- Create example using: `yarn hardhat createZkCertificate --holderFile <holder> --dataFile packages/zk-certificates/example/blumFields.json --zkCertificateType blum --expirationDate <timestamp> --registryAddress <cassiopeia_gip8_registry>`
- Use deployed Cassiopeia GIP8 registry (check deployment-data repo)
- Guardian: Use shared dev account

### 10. Deployment to Cassiopeia

**Deployment Steps**:

1. Build circuits: `yarn hardhat circom` (in zk-certificates package)
2. Deploy via Ignition: `yarn hardhat ignition deploy ignition/modules/BlumProofs.m.ts --network cassiopeia`
3. Save deployment addresses to `deployment-data/zk_certificates/blum.json`:
```json
{
  "cassiopeia": {
    "guardian_registry": "<from GIP8>",
    "certificate_registry": "<from GIP8>",
    "score_sum_verifier": "0x...",
    "score_sum_wrapper": "0x...",
    "score_sum_dapp": "0x...",
    "score_thresholds_verifier": "0x...",
    "score_thresholds_wrapper": "0x...",
    "score_thresholds_dapp": "0x..."
  }
}
```


### 11. Frontend Integration

**File**: `packages/galactica-passport-poc/src/pages/index.tsx`

Add button around line 625 (after twitter proof button):

```tsx
<Card
  content={{
    title: 'Blum + score sum proof',
    description: '1. Generate proof that Blum certificate has sufficient combined scores. 2. Send for on-chain verification.',
    button: (
      <GeneralButton
        onClick={blumProofGenClick}
        disabled={false}
        text="Generate & Submit"
      />
    ),
  }}
  disabled={false}
  fullWidth={false}
/>
```

Add handler function (pattern from `twitterProofGenClick` around line 374):

```typescript
const blumProofGenClick = async () => {
  try {
    dispatch({ type: MetamaskActions.SetInfo, payload: `ZK proof generation in Snap running...` });
    
    const proofInput = {
      currentTime: await getCurrentBlockTime(),
      scoreSumThreshold: '150000000000000000000', // 150.0 with 18 decimals
    };
    
    const res = await generateZKProof({
      input: proofInput,
      prover: await getProver('provers/blumScoreSumProof.json'),
      requirements: {
        zkCertStandard: KnownZkCertStandard.Blum,
        registryAddress: addresses.blumZkCertificateRegistry, // add to config
      },
      userAddress: getUserAddress(),
      description: 'This ZK proof shows: Your Blum combined scores exceed 150.',
      publicInputDescriptions: blumScoreSumProofPublicInputDescriptions, // define in config/snap
      zkInputRequiresPrivKey: false,
    }, defaultSnapOrigin);
    
    // Process and submit proof...
  } catch (error) { /* ... */ }
};
```

**Configuration updates**:

- Add to `packages/galactica-dapp/src/config/addresses.ts`: `blumZkCertificateRegistry` (Cassiopeia address)
- Add to `packages/galactica-dapp/src/config/snap.ts`: `blumScoreSumProofPublicInputDescriptions`

### 12. Pull Request

**Branch**: `feature/blum-zk-proofs`

**PR Description**:

- Summary of two new proof types
- Circuit specifications and public inputs
- Deployment addresses on Cassiopeia
- Link to example certificate
- Testing instructions

## Key Technical Notes

1. **Score Precision**: Blum scores are floats converted to 18-decimal fixed-point BigInts in circuits (e.g., 85.5 → 85500000000000000000)
2. **Content Hash Order**: Blum content fields hashed alphabetically: activityScore, sybilScore, telegramId
3. **Threshold Format**: All threshold inputs in circuits use 18-decimal representation
4. **Registry**: Use existing GIP8 registry deployed at cassiopeia
5. **Verifier Pattern**: Both proof types use similar wrapper pattern with configurable thresholds at verification time