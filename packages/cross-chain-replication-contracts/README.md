# Cross-Chain Replication Contracts

This package implements cross-chain state replication for the ZK Certificate Registry using the Hyperlane messaging bridge. It enables ZK proof verification on multiple EVM-compatible chains by replicating the registry's state (Merkle roots and queue pointer) from a source chain to destination chains.

## Components

- **RegistryStateSender**: Reads state from source ZkCertificateRegistry and dispatches updates via Hyperlane
- **RegistryStateReceiver**: Receives messages on destination chains and updates the replica registry
- **ZkCertificateRegistryReplica**: Read-only replica providing the same verification interface as the source registry

## Setup

Install dependencies:
```shell
yarn install
```

## Building

Build the contracts:
```shell
yarn build
```

## Testing

Run all tests:
```shell
yarn test
```

Run specific test types:
```shell
yarn hardhat test solidity    # Solidity unit tests
yarn hardhat test nodejs      # TypeScript integration tests
```

## Deployment

### Deploy Replica and Receiver Contracts

Use the `deployReplica.ts` script to deploy the full replication setup:

```shell
yarn hardhat run scripts/deployReplica.ts
```

This script will:
1. Deploy the `RegistryStateSender` contract to the origin chain
2. Deploy the `ZkCertificateRegistryReplica` and `RegistryStateReceiver` contracts to the destination chain
3. Initialize the sender with the receiver's address

**Configuration**: Edit the script parameters at the top to configure:
- Origin/destination chain names and types
- Contract addresses (registry, guardian registry, mailboxes)
- Domain IDs and deployment parameters

In the future this is going to be moved to a hardhat task with nice parameters.

### Manual State Update

To manually trigger a state replication from origin to destination:

```shell
npx hardhat run scripts/relayUpdate.ts
```

This script:
1. Connects to the origin chain
2. Calls `relayState()` on the RegistryStateSender contract
3. Pays the required Hyperlane dispatch fee
4. Triggers state synchronization to the destination chain

**Configuration**: Update the origin chain, type, and sender address parameters in the script.

## Networks

The package supports deployment to various EVM networks via Hyperlane. Common configurations include:
- **Origin**: Arbitrum Sepolia (Galactica Network)
- **Destination**: Sepolia, Polygon, Optimism, etc.

Ensure your Hardhat config includes the appropriate network configurations and private keys for deployment.
