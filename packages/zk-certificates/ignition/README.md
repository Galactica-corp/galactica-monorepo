# Hardhat Ignition Deployment Modules

This directory contains Hardhat Ignition modules that replace the old deployment scripts for smart contract deployment.

## Overview

The deployment system has been refactored from traditional Hardhat scripts to use Hardhat Ignition, which provides:
- Declarative deployment configuration
- Better dependency management
- Parameter injection
- Deployment state management
- Resumable deployments

## Prerequisites

1. Install dependencies: `yarn install`
2. Prepare Poseidon artifacts: `yarn hardhat run scripts/prepare-poseidon.ts`
3. Fix compilation issues (if any) - the `virtual` keyword has been added to `ChainAgnosticCalls.sol`

## Modules

### Core Infrastructure Modules

#### 1. GuardianRegistry.m.ts
- Deploys the GuardianRegistry contract
- Basic guardian management functionality

#### 2. Poseidon.m.ts  
- Deploys PoseidonT3 hash function contract
- Required for zkSNARK operations

#### 3. Infrastructure.m.ts
- **Main infrastructure deployment module**
- Deploys: GuardianRegistry, Institution accounts, PoseidonT3, ZkKYCRegistry
- Sets up guardian roles and configurations
- Configures queue expiration time and HumanIDSaltRegistry

### Application Modules

#### 4. RepeatableZKPTest.m.ts
- Deploys mock verifier and ZkKYC wrapper
- Creates RepeatableZKPTest contract with SBT functionality
- Uses MockZkKYC for testing (real verifiers require circom setup)

#### 5. BasicKYCExample.m.ts
- Deploys BasicKYCExampleDApp
- Depends on RepeatableZKPTest module
- Creates a complete KYC verification example

#### 6. ExampleDApp.m.ts (In Progress)
- Deploys AgeCitizenshipKYC wrapper with MockZkKYC
- Creates example DApp with token functionality
- Demonstrates age/citizenship verification

#### 7. CompleteTestSetup.m.ts
- **Master deployment module**
- Orchestrates deployment of all components
- Currently uses individual modules above

## Parameter Files

Parameter files in `ignition/params/` allow customization of deployments:

- `infrastructure.json` - Core infrastructure parameters
- `basic-kyc-example.json` - BasicKYC example parameters  
- `complete-test-setup.json` - Full deployment parameters

### Parameter Structure
```json
{
  "GuardianRegistryModule": {
    "description": "ZkKYC GuardianRegistry"
  },
  "InfrastructureModule": {
    "merkleDepth": 32,
    "queueExpirationTime": 300,
    "description": "ZkKYC RecordRegistry"
  },
  "RepeatableZKPTestModule": {
    "sbtUri": "ipfs://QmVG5b34f8DHGnPZQwi1GD4NUXEVhh7bTub5SG6MPHvHz6",
    "sbtName": "Repeatable KYC Verification SBT",
    "sbtSymbol": "KYCREP"
  }
}
```

## Usage

### Deploy Individual Modules

```bash
# Deploy core infrastructure
yarn hardhat ignition deploy ignition/modules/Infrastructure.m.ts --parameters ignition/params/infrastructure.json

# Deploy BasicKYC example
yarn hardhat ignition deploy ignition/modules/BasicKYCExample.m.ts --parameters ignition/params/basic-kyc-example.json
```

### Deploy to Specific Networks

```bash
# Deploy to a specific network
yarn hardhat ignition deploy ignition/modules/Infrastructure.m.ts --network galaAndromeda --parameters ignition/params/infrastructure.json
```

### View Deployment Status

```bash
# Check deployment status
yarn hardhat ignition status <deployment-id>

# Verify deployed contracts
yarn hardhat ignition verify <deployment-id>
```

## Migration from Old Scripts

The following old deployment scripts have been migrated:

| Old Script | New Ignition Module | Status |
|------------|--------------------|---------|
| `scripts/deploy/deployInfrastructure.ts` | `Infrastructure.m.ts` | ✅ Complete |
| `scripts/deploy/deploymentSteps/repeatableZKPTest.ts` | `RepeatableZKPTest.m.ts` | ✅ Complete |
| `scripts/deploy/deploymentSteps/basicKYCExampleDApp.ts` | `BasicKYCExample.m.ts` | ✅ Complete |
| `scripts/deploy/deploymentSteps/exampleDApp.ts` | `ExampleDApp.m.ts` | 🔄 In Progress |
| `scripts/deploy/deployCompleteTestSetup.ts` | `CompleteTestSetup.m.ts` | 🔄 In Progress |

## Key Improvements

1. **Modular Design**: Each deployment aspect is in a separate, reusable module
2. **Parameter Injection**: Easy customization through JSON parameter files
3. **Dependency Management**: Automatic handling of deployment dependencies
4. **State Management**: Ignition tracks deployment state and allows resumption
5. **Type Safety**: TypeScript modules with compile-time validation
6. **Testing Ready**: Uses mock contracts when real verifiers aren't available

## Known Issues & Workarounds

1. **Circom Verifiers**: Real ZKP verifiers require circom setup with ptau files
   - **Workaround**: Using MockZkKYC contracts for testing
   - **Solution**: Run `yarn hardhat circom` with proper ptau files for production

2. **Contract Parameter Validation**: Ignition validates constructor parameters
   - **Fix Applied**: All contract constructors now have correct parameter counts
   - **Example**: AgeCitizenshipKYC requires 6 parameters, GuardianRegistry.grantGuardianRole requires 3

3. **Virtual Function Override**: Solidity 0.8 requires `virtual` keyword for overridable functions
   - **Fix Applied**: Added `virtual` to `ChainAgnosticCalls.sol:getBlockNumber()`

## Successful Test Results

✅ **Infrastructure Module**: Deployed successfully with all components  
✅ **BasicKYCExample Module**: Complete deployment with SBT functionality  
✅ **Poseidon Preparation**: Artifact generation working  
✅ **Parameter Validation**: All constructor parameters validated  
✅ **Guardian Role Setup**: Institution accounts configured as guardians  

## Next Steps

1. Complete ExampleDApp and CompleteTestSetup modules
2. Add circom setup for real verifier deployment
3. Create deployment verification scripts
4. Add network-specific parameter files
5. Document contract interaction patterns

## Examples

See the successful deployment outputs:
- Infrastructure: 6 contracts deployed including GuardianRegistry, ZkKYCRegistry, PoseidonT3
- BasicKYCExample: 10 contracts deployed including full KYC verification stack

The refactored system provides a clean, maintainable approach to smart contract deployment with better error handling and state management than the previous script-based approach.