import {
  PublicClient,
  WalletClient,
  WatchEventReturnType,
  Log,
  Address,
  decodeEventLog,
  zeroAddress
} from 'viem';

import zkCertificateRegistryArtifact from '@galactica-net/zk-certificates/artifacts/contracts/ZkCertificateRegistry.sol/ZkCertificateRegistry.json';
import registryStateSenderArtifact from '@galactica-net/cross-chain-replication-contracts/artifacts/contracts/RegistryStateSender.sol/RegistryStateSender.json';

/**
 * Cross-chain Replicator Service
 * Monitors ZkCertificateRegistry events and relays state changes to destination chains
 */
export class CrossChainReplicator {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: any;
  private registryAddress: Address = zeroAddress;
  private senderAddress: Address;
  private unwatch?: WatchEventReturnType;
  private isRunning = false;

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    account: any,
    senderAddress: Address
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.account = account;
    this.senderAddress = senderAddress;
  }

  /**
   * Start the replicator service
   */
  async start(startBlock?: bigint): Promise<void> {
    if (this.isRunning) {
      console.log('Replicator is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting Cross-chain Replicator`);

    this.registryAddress = await this.publicClient.readContract({
      address: this.senderAddress,
      abi: registryStateSenderArtifact.abi,
      functionName: 'registry',
      args: [],
    }) as Address;

    // Start watching for events
    this.unwatch = this.publicClient.watchEvent({
      address: this.registryAddress,
      events: zkCertificateRegistryArtifact.abi.filter((event) => event.type === 'event' && (event.name === 'zkCertificateAddition' || event.name === 'zkCertificateRevocation')),
      fromBlock: startBlock,
      onLogs: (logs) => this.handleEvents(logs),
      onError: (error) => {
        console.error('Error watching events:', error);
        // In a production service, you might want to implement retry logic here
      },
    });
  }

  /**
   * Stop the replicator service
   */
  async stop(): Promise<void> {
    if (this.unwatch) {
      this.unwatch();
      this.unwatch = undefined;
    }
    this.isRunning = false;
    console.log('Cross-chain Replicator stopped');
  }

  /**
   * Handle incoming events from the registry
   */
  private async handleEvents(logs: Log[]): Promise<void> {
    console.log(`Received ${logs.length} event(s)`);

    for (const log of logs) {
      try {
        // Parse the log using viem's decodeEventLog
        const decodedLog = decodeEventLog({
          abi: zkCertificateRegistryArtifact.abi.filter((event) => event.type === 'event'),
          data: log.data,
          topics: log.topics,
        }) as any;

        if (decodedLog.eventName === 'zkCertificateAddition' || decodedLog.eventName === 'zkCertificateRevocation') {
          console.log(`Processing ${decodedLog.eventName} event:`, {
            hash: log.transactionHash,
            block: log.blockNumber,
            certificateHash: decodedLog.args.zkCertificateLeafHash,
            guardian: decodedLog.args.Guardian,
            index: decodedLog.args.index,
          });

          await this.relayState();
        }
      } catch (error) {
        console.error('Error processing event:', error);
        // In production, you might want to implement error handling and retry logic
      }
    }
  }

  /**
   * Call relayState() on the RegistryStateSender contract
   */
  private async relayState(): Promise<void> {
    try {
      console.log('Calling relayState()...');

      // First, get the quote for the relay fee
      const fee = await this.publicClient.readContract({
        address: this.senderAddress,
        abi: registryStateSenderArtifact.abi,
        functionName: 'quoteRelayFee',
        args: [],
      });

      console.log(`Estimated relay fee: ${fee} wei`);

      // Call relayState with the estimated fee
      const hash = await this.walletClient.writeContract({
        address: this.senderAddress,
        abi: registryStateSenderArtifact.abi,
        functionName: 'relayState',
        args: [],
        value: fee as bigint,
        account: this.account,
        chain: null,
      });

      console.log(`Relay transaction submitted: ${hash}`);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log(`Relay transaction confirmed in block ${receipt.blockNumber}`);

      if (receipt.status === 'success') {
        console.log('State relay successful');
      } else {
        console.error('State relay failed');
      }
    } catch (error) {
      console.error('Error calling relayState():', error);
      throw error;
    }
  }

  /**
   * Get the current block number
   */
  async getCurrentBlockNumber(): Promise<bigint> {
    return await this.publicClient.getBlockNumber();
  }

  /**
   * Check if the service is running
   */
  get isServiceRunning(): boolean {
    return this.isRunning;
  }
}
