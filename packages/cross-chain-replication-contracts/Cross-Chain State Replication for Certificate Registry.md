# **Cross-Chain State Replication for ZK Certificate Registry**

## **1\. Overview**

This document outlines the technical specification for implementing cross-chain state replication for the ZK Certificate Registry. The primary goal is to enable the verification of Zero-Knowledge (ZK) proofs on multiple EVM-compatible chains by ensuring they have access to an up-to-date state of the registry.

Currently, the ZkCertificateRegistry smart contract exists on a single EVM chain. This feature will extend its functionality by replicating its key state variables to other EVM chains using the Hyperlane messaging bridge.

The state to be replicated includes:

1. **Valid Merkle Roots:** The list of historical and current Merkle roots (merkleRoots) that represent the state of all certificates in the registry.
2. **Oldest Valid Merkle Root:** The Merkle root that marks the boundary from which all subsequent roots are considered valid for proof verification. This replaces the index-based approach to ensure robustness against dropped messages.
3. **Queue Processing Index:** An index (currentQueuePointer) that indicates how far the certificate processing queue has been synced. This is crucial for verifying that a specific certificate has been included in a given Merkle root.

An open-source, off-chain service named the "Cross-chain Replicator" will monitor the source registry contract for state changes. Upon detecting an update, this service will submit a transaction to the source chain to relay the new state to the destination chains via Hyperlane. While the official service will ensure timely updates, the code will be publicly available for anyone to run. Authentication of the relayed messages will be handled by the receiving smart contract on the destination chains to ensure data integrity and security.

## **2\. Requirements**

1. **Single Source of Truth:** The ZK Certificate Registry on the Galactica Network chain shall be the definitive source of truth. All state modifications, such as adding or revoking certificates, must occur only on this primary contract.
2. **State Replication:** The following state variables must be replicated from the source registry to replica registries on destination chains:
   - The complete array of merkleRoots.
   - The oldestValidMerkleRoot, which is the Merkle root that marks the boundary from which all subsequent roots are considered valid.
   - The currentQueuePointer, indicating the processing progress of the certificate queue.
3. **State Update Logic:**
   - Upon a certificate addition or revocation, the newly generated Merkle roots shall be appended to the merkleRoots array on the replica.
   - The oldestValidMerkleRoot from the source is used to determine the merkleRootValidIndex on the replica. If this root exists in the replica's merkleRoots array, its index becomes the new merkleRootValidIndex. If it doesn't exist (due to dropped messages), the root is added to the array to recover the state, and then its index becomes the merkleRootValidIndex.
   - The currentQueuePointer shall be updated on the replica to match the source after every successful addition or revocation.
4. **Interface Consistency:** Replicated registry contracts must expose the same read-only interface as the origin contract for ZK proof verification. This includes functions like verifyMerkleRoot(bytes32), getMerkleRoots(), and merkleRoot().
5. **Functionality Segregation:** Write functions, including addZkCertificate, revokeZkCertificate, and registerToQueue, must be disabled or removed from the replicated registry contracts to prevent state divergence.
6. **Architectural Decoupling:** The logic must be decoupled from the core registry contracts. A dedicated Sender contract on the source chain will read state from the registry and dispatch messages via the bridge, and a dedicated Receiver contract on the destination chain will receive messages and perform permissioned updates on the replicated registry. This ensures the core registry ABIs remain independent of the bridging solution.
7. **Scalability:** The architecture must support replicating multiple, distinct ZkCertificateRegistry instances to various destination chains simultaneously.
8. **Performance and Cost Efficiency:** The system should be designed for high throughput. A mechanism for batching multiple state updates into a single cross-chain message should be considered to balance replication latency with transaction costs.
9. **Security and Reliability:**
   - **Authorization:** The Receiver contract on destination chains must only accept state updates originating from its designated Sender contract on the Galactica Network chain.
   - **Data Integrity:** The cross-chain messaging protocol (Hyperlane) must guarantee that messages are not tampered with during transit.
   - **Order of Operations:** The system must ensure that state updates are applied on the replica in the same order they occurred on the source chain to maintain consistency.
   - **Dropped Message Recovery:** The system must be robust against dropped or failed messages by using root-based validation instead of index-based validation, allowing the replica to recover missing state when possible.
10. **Initialization:** A secure and verifiable process must be defined for deploying and initializing a new replicated registry with the complete and current state of the source registry.
11. **Off-Chain Replicator Service:**
    - The "Cross-chain Replicator" service must reliably monitor the source registry for state-changing events.
    - The service must be fault-tolerant, with mechanisms to handle RPC node failures and automatically recover and resume replication.
    - The service's code must be open-source to allow for transparent operation and community-run instances.

## **3\. Architecture/Design**

### **3.1 Components**

The system consists of the following components, distributed across the source chain (Galactica), a destination chain, and an off-chain service.

**Source Chain (Galactica Network)**

- **ZkCertificateRegistry (Source Contract):** The existing, canonical smart contract. It is the single source of truth for all certificate data and state changes.
- **RegistryStateSender (Sender Contract):** A new contract responsible for reading the state from the ZkCertificateRegistry, encoding it into a message, and dispatching it via the Hyperlane Mailbox.
- **Hyperlane Mailbox (Source Bridge):** The entry point to the Hyperlane network on the source chain. It accepts messages from the RegistryStateSender.

**Off-Chain**

- **Cross-chain Replicator (Service):** An off-chain service that monitors the ZkCertificateRegistry for state-change events. Upon detection, it calls the RegistryStateSender to initiate the replication process.

**Destination Chain**

- **Hyperlane Mailbox (Destination Bridge):** The exit point of the Hyperlane network on the destination chain. It receives the message and forwards it to the RegistryStateReceiver.
- **RegistryStateReceiver (Receiver Contract):** A new contract that listens for messages from the Hyperlane Mailbox. It authenticates the sender, decodes the message, and updates the ZkCertificateRegistryReplica with the new state.
- **ZkCertificateRegistryReplica (Replica Contract):** A read-only replica of the source registry. It stores the replicated state and exposes the necessary view functions for ZK proof verification. It can only be modified by the RegistryStateReceiver.

### **3.2 System Diagram**

sequenceDiagram
participant Guardian
participant SourceRegistry as ZkCertificateRegistry (Source)
participant Replicator as Cross-chain Replicator (Off-chain)
participant Sender as RegistryStateSender (Source)
participant Hyperlane
participant Receiver as RegistryStateReceiver (Destination)
participant ReplicaRegistry as ZkCertificateRegistryReplica (Destination)

    Guardian->>+SourceRegistry: addZkCertificate()
    SourceRegistry-->>-Guardian: Emits event

    Replicator->>SourceRegistry: Listens for events
    Replicator->>+Sender: relayState()

    Sender->>SourceRegistry: getMerkleRoots(), etc.
    Sender->>+Hyperlane: dispatch(message)
    Hyperlane-->>-Sender:

    Note over Hyperlane: Cross-chain message relay

    Hyperlane->>+Receiver: handle(message)

    Receiver->>+ReplicaRegistry: updateState(newState)
    ReplicaRegistry-->>-Receiver:

    Receiver-->>-Hyperlane:

## **4\. Interfaces**

### **4.1 ZkCertificateRegistry (Source)**

The RegistryStateSender will interact with the public state-reading functions of the existing source contract.

// Reads a slice of the merkle roots array, starting from \_startIndex.  
// This is used to fetch new roots since the last replication.  
function getMerkleRoots(uint256 \_startIndex) external view returns (bytes32\[\] memory);

// Reads the index from which Merkle roots are considered valid.  
function merkleRootValidIndex() external view returns (uint256);

// NOTE: For cross-chain replication, the actual valid Merkle root boundary is sent instead of the index to ensure robustness against dropped messages.

// Reads the current processing position in the certificate queue.  
function currentQueuePointer() external view returns (uint256);

### **4.2 ZkCertificateRegistryReplica (Replica)**

The replica contract provides the same read-only interface for ZK verifiers but includes a permissioned function for state updates.

// \--- View Functions (for ZK Verifiers) \---

// Returns a slice of the replicated Merkle roots array, starting from \_startIndex.  
function getMerkleRoots(uint256 \_startIndex) external view returns (bytes32\[\] memory);

// Returns the index from which Merkle roots are considered valid.  
function merkleRootValidIndex() external view returns (uint256);

// Returns the current processing position in the certificate queue.  
function currentQueuePointer() external view returns (uint256);

// Returns the latest Merkle root.  
function merkleRoot() external view returns (bytes32);

// Verifies if a given Merkle root is valid.  
function verifyMerkleRoot(bytes32 \_merkleRoot) external view returns (bool);

// \--- State Update Function (Permissioned) \---

// Updates the registry state. Can only be called by the RegistryStateReceiver.  
// Uses oldestValidMerkleRoot instead of index for robustness against dropped messages.  
function updateState(bytes32\[\] calldata newMerkleRoots, bytes32 oldestValidMerkleRoot, uint256 newQueuePointer) external;

### **4.3 RegistryStateSender (Sender)**

This contract is responsible for sending state updates from the source chain. Each instance is configured for a single destination.

// Contract constructor. Sets the destination domain and other contract addresses.  
constructor(address \_mailbox, address \_registry, uint32 \_destinationDomain);

// Owner-only function to set the receiver contract address on the destination chain.  
function setReceiverAddress(address \_receiverAddress) external onlyOwner;

// Reads the latest state from the registry and dispatches it to the configured destination chain.  
// Sends the oldestValidMerkleRoot instead of the index for robustness against dropped messages.  
// Called by the off-chain Cross-chain Replicator service.  
function relayState() external payable;

### **4.4 RegistryStateReceiver (Receiver)**

This contract receives messages on the destination chain and updates the replica.

// Contract constructor.  
constructor(address \_mailbox, address \_replicaRegistry, uint32 \_originDomain, address \_senderAddress);

// Handles incoming messages from the Hyperlane Mailbox.  
// This function authenticates the message source and triggers the state update on the replica.  
// The message contains oldestValidMerkleRoot instead of index for robustness against dropped messages.  
function handle(uint32 \_origin, bytes32 \_sender, bytes calldata \_messageBody) external onlyMailbox;

## **5\. Implementation Details**

### **5.1 ZkCertificateRegistry (Source)**

- **Interfaces:** The contract's functionality will be split into two interfaces for clarity:
  - IReadableZkCertRegistry: Contains all public view functions required by ZK verifiers and the RegistryStateSender (e.g., getMerkleRoots, merkleRootValidIndex).
  - IWritableZKCertRegistry: Contains all state-changing functions used by guardians (e.g., addZkCertificate, revokeZkCertificate, registerToQueue).
- **Merkle Roots Storage (Optional Optimization):** To mitigate unbounded storage growth and reduce gas costs, the merkleRoots array could be implemented as a ring buffer. This would cap its size, and new roots would overwrite the oldest ones.

### **5.2 ZkCertificateRegistryReplica (Replica)**

- **Implementation:** This contract will implement the IReadableZkCertRegistry interface to ensure compatibility for ZK verifiers. It will also implement the permissioned updateState function.
- **State Update Logic:** The updateState function receives oldestValidMerkleRoot instead of an index. It maps this root to the appropriate merkleRootValidIndex. If the root doesn't exist (due to dropped messages), it adds the root to recover the state and then sets the merkleRootValidIndex accordingly.
- **Dropped Message Recovery:** When a message containing a oldestValidMerkleRoot that doesn't exist in the replica is received, the replica adds this root to its merkleRoots array to recover the missing state, ensuring that subsequent valid roots can still be verified.
- **Guardian Registry Address:** The replica stores the address of the source chain's GuardianRegistry for informational purposes. However, it cannot make direct cross-chain calls to it. Any guardian metadata from the source chain required for verification on the destination chain must be either included in the ZK proof itself or replicated via a similar cross-chain mechanism.

### **5.3 RegistryStateSender (Sender)**

- **State Fetching:** When relayState() is called, the contract will read the latest merkleRootValidIndex and currentQueuePointer from the source registry. It will also determine which new Merkle roots have been added since the last update and fetch them using getMerkleRoots(uint256 \_startIndex).
- **Oldest Valid Merkle Root:** Instead of sending the merkleRootValidIndex directly, the contract fetches the actual Merkle root at position `merkleRootValidIndex - 1` from the source registry's merkleRoots array. This root represents the boundary from which all subsequent roots are considered valid.
- **Message Encoding:** The state update (new roots, oldestValidMerkleRoot, queue pointer) will be ABI-encoded into a bytes payload for the message body.
- **Fee Handling:** The relayState() function is payable. The fee required by Hyperlane will be passed as msg.value by the Cross-chain Replicator service. The contract will use mailbox.quoteDispatch() to calculate the required fee and ensure the provided value is sufficient before calling mailbox.dispatch().

### **5.4 RegistryStateReceiver (Receiver)**

- **Authentication:** The handle function will contain strict checks to ensure messages are only processed if they come from the Hyperlane Mailbox (onlyMailbox modifier), the configured origin domain, and the designated RegistryStateSender contract address.
- **Message Decoding:** Upon successful authentication, the function will abi.decode() the \_messageBody to extract the state update, which includes the oldestValidMerkleRoot instead of an index.
- **State Update:** It will then call replicaRegistry.updateState() with the decoded data to apply the changes. The replica will handle mapping the oldestValidMerkleRoot to the appropriate merkleRootValidIndex, including recovery from dropped messages.

### **5.5 Cross-chain Replicator (Off-chain Service)**

- **Operations:** The service will be a containerized application designed to run on a cloud orchestration platform like Kubernetes for high availability and automated recovery. It will use structured logging for monitoring and debugging.
- **Key Management:** The service will require an EVM private key to sign and send transactions. This key must be stored securely using a secrets management system (e.g., Kubernetes Secrets, HashiCorp Vault, or a cloud provider's KMS).
- **Configuration:** A configuration file (e.g., YAML or JSON) will define the source chain RPC endpoint, the ZkCertificateRegistry address to monitor, and a list of RegistryStateSender contract addresses it is responsible for triggering.
- **Deployment Automation:** The project repository will include deployment scripts, preferably using a tool like Hardhat Ignition, to ensure reliable and repeatable deployment of the RegistryStateSender, RegistryStateReceiver, and ZkCertificateRegistryReplica contracts.

### **5.6 Hyperlane Mailbox (Testing)**

- **Mocking:** For local development and unit testing, a mock Mailbox contract will be utilized. This mock will bypass the actual cross-chain mechanism and directly call the RegistryStateReceiver.handle() function within the same test environment. The feasibility of using official Hyperlane testing libraries will be investigated first to avoid reinventing the wheel.

## **6\. Implementation Subtasks**

### **6.1 Create `cross-chain-replication` Package**

- **Prompt:** "Create a new Hardhat package named `cross-chain-replication` within the monorepo. Initialize it with TypeScript and Hardhat Ignition support. Configure the package with standard `package.json`, `hardhat.config.ts`, `.gitignore`, and ESLint files. Set the license to GPLv3."
- **Testing:** "Verify that `yarn build` and `yarn test` commands execute successfully using the default Hardhat template."

### **6.2 Integrate Hyperlane Mock Mailbox**

- **Prompt:** "In the new package, create a `contracts/test/MockMailbox.sol` contract that simulates the `dispatch` and `handle` flow for testing. It should store dispatched messages and allow a test runner to process them, triggering the recipient's `handle` function. Adapt the logic from the Hyperlane monorepo's `mockMailbox.test.ts` (commit `dae8b26...`) to create a test file that verifies this mock contract."
- **Testing:** "Run the new test file. It should successfully deploy the `MockMailbox`, dispatch a message to a mock recipient, process the message, and confirm the recipient's `handle` function was called with the correct data."

### **6.3 Refactor `ZkCertificateRegistry` Interfaces**

- **Prompt:** "In the original `zk-certificate-registry` package, create two new interface files: `IReadableZkCertRegistry.sol` and `IWritableZKCertRegistry.sol`. Move the respective function signatures from the main contract into these interfaces as specified in section 5.1. Update the `ZkCertificateRegistry.sol` contract to implement both interfaces. Modify the `getMerkleRoots` function to accept a `_startIndex` parameter."
- **Testing:** "All existing unit tests for the `ZkCertificateRegistry` must continue to pass after the refactoring. Add a new test case specifically for the `getMerkleRoots(startIndex)` functionality to verify it returns the correct slice of the roots array."

### **6.4 Implement `ZkCertificateRegistryReplica`**

- **Prompt:** "In the `cross-chain-replication` package, create `ZkCertificateRegistryReplica.sol`. It must implement the `IReadableZkCertRegistry` interface and the `updateState` function with signature `updateState(bytes32[] calldata newMerkleRoots, bytes32 oldestValidMerkleRoot, uint256 newQueuePointer)`. Access to `updateState` must be restricted, initially to an owner. The contract should store `merkleRoots`, `merkleRootValidIndex`, and `currentQueuePointer`. The updateState function must handle dropped message recovery by adding missing oldestValidMerkleRoot to the merkleRoots array when necessary."
- **Testing:** "Write unit tests to verify: 1\. The contract deploys successfully. 2\. `updateState` reverts when called by an unauthorized address. 3\. After a successful `updateState` call, all `IReadableZkCertRegistry` view functions return the new, correct values. 4\. The contract correctly handles dropped messages by recovering missing oldestValidMerkleRoot."

### **6.5 Implement `RegistryStateSender`**

- **Prompt:** "Create `RegistryStateSender.sol`. It should have the constructor and functions as defined in the interface in section 4.3. The `relayState` function must read the current state from the source registry, determine the oldestValidMerkleRoot from the merkleRootValidIndex, ABI-encode it into a bytes payload `(bytes32[] memory, bytes32, uint256)`, and call `dispatch` on the mailbox address."
- **Testing:** "Write unit tests using mock contracts for the registry and mailbox. Verify that `relayState` calls `dispatch` on the mock mailbox with the correctly encoded data payload containing the oldestValidMerkleRoot. Test that `setReceiverAddress` can only be called by the owner."

### **6.6 Implement `RegistryStateReceiver`**

- **Prompt:** "Create `RegistryStateReceiver.sol`. Implement the constructor and `handle` function as per section 4.4. The `handle` function must verify that `_origin` and `_sender` match the values set in the constructor. It should then decode the `_messageBody` and call `updateState` on the replica registry."
- **Testing:** "Write unit tests using a mock replica. Verify that `handle` reverts if the `_origin` or `_sender` is incorrect. Test that a valid message correctly decodes and calls `updateState` on the mock replica with the right parameters."

### **6.7 Create Smart Contract Integration Test**

- **Prompt:** "Create a new integration test file. In the test setup, deploy the full suite of contracts: `ZkCertificateRegistry`, `ZkCertificateRegistryReplica`, `RegistryStateSender`, `RegistryStateReceiver`, and the `MockMailbox`."
- **Testing:** "Write an end-to-end test that: 1\. Adds a certificate to the source `ZkCertificateRegistry`. 2\. Calls `relayState()` on the `RegistryStateSender`. 3\. Triggers message processing in the `MockMailbox`. 4\. Asserts that the `ZkCertificateRegistryReplica` state correctly reflects the change. 5\. Repeats this process for a revocation and a batch of multiple updates to ensure state consistency. 6\. Includes a test for dropped message recovery where the replica correctly recovers missing state when oldestValidMerkleRoot is not found in its current merkleRoots array."

### **6.8 Create Hardhat Ignition Deployment Modules**

- **Prompt:** "Create two Hardhat Ignition modules. The first, `SourceDeploy.js`, will deploy the `RegistryStateSender`. The second, `DestinationDeploy.js`, will deploy the `ZkCertificateRegistryReplica` and `RegistryStateReceiver`. The modules must accept parameters for constructor arguments (e.g., registry address, domain IDs)."
- **Testing:** "Create a Hardhat script that uses these modules to deploy the contracts to a local Hardhat node. The script should succeed and log the addresses of the newly deployed contracts."

### **6.9 Implement Off-Chain Replicator Service**

- **Prompt:** "In a new `service/` directory, create a TypeScript application for the Cross-chain Replicator. Use Ethers.js. The service should: 1\. Load configuration from a file or environment variables (RPC URL, private key, contract addresses). 2\. Connect to the source chain and listen for `zkCertificateAddition` and `zkCertificateRevocation` events on the `ZkCertificateRegistry`. 3\. Upon detecting an event, call the `relayState()` function on the `RegistryStateSender` contract. 4\. Handle the updated message format that includes oldestValidMerkleRoot instead of merkleRootValidIndex."
- **Testing:** "Create a test script that runs the replicator service against a local Hardhat node. The script will first deploy the contracts, then make a transaction to the `ZkCertificateRegistry` to emit an event. Verify that the running service detects the event and successfully calls `relayState()` with the correct message format."
