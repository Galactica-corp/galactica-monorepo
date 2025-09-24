# Cross-Chain Replicator Service

The Cross-chain Replicator Service monitors the ZkCertificateRegistry on the source chain for state changes and automatically relays those changes to destination chains via Hyperlane.

## Features

- **Event Monitoring**: Listens for `zkCertificateAddition` and `zkCertificateRevocation` events on the source registry
- **Automatic Relay**: Automatically calls `relayState()` on the RegistryStateSender contract when events are detected
- **Threshold-Based Relaying**: Configurable thresholds for immediate vs delayed relay based on change magnitude
- **Delayed Relay**: Small changes are automatically relayed after a configurable delay to ensure no state is lost
- **Multi-Sender Support**: Can monitor multiple RegistryStateSender contracts simultaneously
- **Configuration**: Environment-based and JSON-based configuration for easy deployment
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
yarn build
```

## Configuration

### Environment Variables

Create a `.env` file from `.env.example` with the following variables (the service will automatically load it):

```env
# RPC URL for the source chain
RPC_URL=https://galactica-cassiopeia.g.alchemy.com/v2/<ALCHEMY_API_KEY>

# Private key of the account that will call relayState()
PRIVATE_KEY=0x...
```

### Sender Configuration

The service uses a JSON configuration file `config/senders.json` to define which RegistryStateSender contracts to monitor and their relay behavior:

```json
[
  {
    "address": "0xa69ecE58d576F6249A30C9950F30Da2c214700A2",
    "pollingInterval": 5000,
    "merkleRootsLengthDiffThreshold": 1,
    "queuePointerDiffThreshold": 1,
    "maximumUpdateDelayMs": 60000
  }
]
```

Configuration options:

- **`address`**: The address of the RegistryStateSender contract to monitor
- **`pollingInterval`**: How often to check for changes in milliseconds (default: 5000)
- **`merkleRootsLengthDiffThreshold`**: Minimum number of new Merkle roots required to trigger immediate relay (default: 1)
- **`queuePointerDiffThreshold`**: Minimum number of new queue entries required to trigger immediate relay (default: 1)
- **`maximumUpdateDelayMs`**: Maximum delay in milliseconds before relaying small changes (default: 300000 = 5 minutes)

### Relay Behavior

The service implements intelligent relay behavior based on the configured thresholds:

- **Immediate Relay**: When changes meet or exceed the configured thresholds, the service relays immediately
- **Delayed Relay**: Small changes below the thresholds are queued and automatically relayed after the `maximumUpdateDelayMs` period
- **Revocation Priority**: Certificate revocations always trigger immediate relay regardless of thresholds

This ensures that important state changes are relayed promptly while batching smaller updates for efficiency.

## Usage

### Development Mode

Run the service in development mode with auto-restart:

```bash
yarn dev
```

### Production Mode

Build and run the

```bash
yarn build
yarn start
```

### Relay Decision Logic

The service implements intelligent relay decisions based on configurable thresholds:

1. **Threshold Check**: Compare current state changes against configured thresholds
2. **Immediate Relay**: If changes meet/exceed thresholds, relay immediately
3. **Delayed Relay**: If changes are below thresholds but exist, schedule delayed relay
4. **Timer Management**: Only one delayed timer per sender, cleared on immediate relay
