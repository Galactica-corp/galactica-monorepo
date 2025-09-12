# Cross-Chain Replicator Service

The Cross-chain Replicator Service monitors the ZkCertificateRegistry on the source chain for state changes and automatically relays those changes to destination chains via Hyperlane.

## Features

- **Event Monitoring**: Listens for `zkCertificateAddition` and `zkCertificateRevocation` events on the source registry
- **Automatic Relay**: Automatically calls `relayState()` on the RegistryStateSender contract when events are detected
- **Configuration**: Environment-based configuration for easy deployment
- **Fault Tolerant**: Includes error handling and logging for production use

## Prerequisites

- Node.js >= 22.0.0
- Yarn package manager
- Access to a source chain RPC endpoint
- Private key with sufficient funds for Hyperlane fees

## Installation

The service is a separate package that depends on the cross-chain-replication-contracts package. From the service package root:

```bash
# Install dependencies (if not already done)
yarn install

# Build the service
yarn service:build
```

## Configuration

Create a `.env` file in the `service/` directory with the following variables (the service will automatically load it from the correct location):

```env
# RPC URL for the source chain
RPC_URL=https://rpc.galactica.network

# Private key of the account that will call relayState()
PRIVATE_KEY=0x...

# Address of the source ZkCertificateRegistry contract
REGISTRY_ADDRESS=0x...

# Address of the RegistryStateSender contract
SENDER_ADDRESS=0x...

# Optional: Block number to start listening from (defaults to latest)
START_BLOCK=12345678

# Optional: Polling interval in milliseconds (defaults to 5000ms)
POLLING_INTERVAL=5000
```

## Usage

### Development Mode

Run the service in development mode with auto-restart:

```bash
yarn service:dev
```

### Production Mode

Build and run the service:

```bash
yarn service:build
yarn service:start
```

### Testing

Run the test script that deploys contracts locally and verifies the service:

```bash
yarn service:test
```

The test script will:
1. Deploy all contracts to a local Hardhat node
2. Start the replicator service
3. Add a certificate to emit an event
4. Verify that the service detects the event and calls `relayState()`
5. Confirm that the state was properly replicated

## Architecture

The service consists of several key components:

- **`index.ts`**: Main entry point that loads configuration and starts the service
- **`config.ts`**: Configuration loading and client creation
- **`replicator.ts`**: Core service logic for event monitoring and state relay
- **`types.ts`**: TypeScript type definitions
- **`contracts.ts`**: Contract ABI definitions

## Event Handling

The service monitors two types of events from the ZkCertificateRegistry:

1. **`zkCertificateAddition`**: Triggered when a new certificate is added
2. **`zkCertificateRevocation`**: Triggered when a certificate is revoked

When either event is detected, the service will:
1. Log the event details
2. Query the RegistryStateSender for the required relay fee
3. Call `relayState()` with the appropriate fee
4. Wait for the transaction to be confirmed
5. Log the result

## Security Considerations

- **Private Key Management**: Store the private key securely using environment variables or a key management service
- **Funding**: Ensure the account has sufficient funds to pay Hyperlane relay fees
- **Network Access**: The service needs reliable RPC access to the source chain
- **Error Handling**: The service includes error handling but should be monitored in production

## Production Deployment

For production deployment, consider:

1. **Containerization**: Package the service in a Docker container
2. **Orchestration**: Use Kubernetes or similar for high availability
3. **Monitoring**: Implement logging and alerting for the service
4. **Backup**: Have fallback mechanisms if the service goes down
5. **Load Balancing**: Run multiple instances for redundancy

## Troubleshooting

### Common Issues

1. **"RPC_URL environment variable is required"**: Ensure your `.env` file is properly configured
2. **"Event not detected"**: Check that the registry address is correct and events are being emitted
3. **"Insufficient funds"**: Ensure the account has enough funds for Hyperlane fees
4. **"Contract call failed"**: Verify contract addresses and network connectivity

### Logs

The service provides detailed logging for:
- Service startup and configuration
- Event detection
- Transaction submissions and confirmations
- Errors and failures

Check the logs for troubleshooting information.
