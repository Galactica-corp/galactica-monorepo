import {
  PublicClient,
  WalletClient,
  Address,
} from 'viem';

import registryStateSenderArtifact from '@galactica-net/cross-chain-replication-contracts/artifacts/contracts/RegistryStateSender.sol/RegistryStateSender.json';
import { SenderConfig } from './types.js';

/**
 * Sync status returned by the RegistryStateSender contract
 */
interface SyncStatus {
  merkleRootsLengthDiff: bigint;
  hasNewRevocation: boolean;
  queuePointerDiff: bigint;
}

/**
 * Transaction queue item
 */
interface TransactionQueueItem {
  senderAddress: Address;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

/**
 * Cross-chain Replicator Service
 * Periodically checks sync status and relays state changes to destination chains
 */
export class CrossChainReplicator {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: any;
  private senders: SenderConfig[];
  private pollTimers: Map<Address, NodeJS.Timeout> = new Map();
  private isRunning = false;
  private transactionQueue: TransactionQueueItem[] = [];
  private processingPromise: Promise<void> | null = null;

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    account: any,
    senders: SenderConfig[]
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.account = account;
    this.senders = senders;
  }

  /**
   * Start the replicator service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Replicator is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting Cross-chain Replicator for ${this.senders.length} sender(s)`);

    // Start polling for each sender
    for (const sender of this.senders) {
      console.log(`Starting polling for sender ${sender.address} with ${sender.pollingInterval}ms interval`);

      // Perform initial check immediately
      try {
        await this.checkSyncStatus(sender);
      } catch (error) {
        console.error(`Error during initial sync status check for sender ${sender.address}:`, error);
      }

      // Start periodic polling
      const timer = setInterval(async () => {
        try {
          await this.checkSyncStatus(sender);
        } catch (error) {
          console.error(`Error during sync status check for sender ${sender.address}:`, error);
          // In a production service, you might want to implement retry logic here
        }
      }, sender.pollingInterval);

      this.pollTimers.set(sender.address, timer);
    }
  }

  /**
   * Stop the replicator service
   */
  async stop(): Promise<void> {
    // Clear all polling timers
    for (const [address, timer] of this.pollTimers) {
      clearInterval(timer);
      console.log(`Stopped polling for sender ${address}`);
    }
    this.pollTimers.clear();

    this.isRunning = false;
    console.log('Cross-chain Replicator stopped');
  }

  /**
   * Check sync status and relay state if needed
   */
  private async checkSyncStatus(sender: SenderConfig): Promise<void> {
    try {
      // Get sync status from the RegistryStateSender contract
      const syncResponse = await this.publicClient.readContract({
        address: sender.address,
        abi: registryStateSenderArtifact.abi,
        functionName: 'getSyncStatus',
        args: [],
      }) as [bigint, boolean, bigint];

      const syncStatus: SyncStatus = {
        merkleRootsLengthDiff: syncResponse[0],
        hasNewRevocation: syncResponse[1],
        queuePointerDiff: syncResponse[2],
      };

      // Check if there's anything to sync
      const hasNewAdditions = syncStatus.merkleRootsLengthDiff > 0n;
      const hasNewRevocations = syncStatus.hasNewRevocation;
      const hasQueueUpdates = syncStatus.queuePointerDiff > 0n;

      if (hasNewAdditions || hasNewRevocations || hasQueueUpdates) {
        console.log(`Detected changes in registry state for sender ${sender.address}, ${JSON.stringify(syncStatus)}, triggering relay...`);
        await this.relayState(sender);
      } else {
        console.log(`No new changes detected for sender ${sender.address}`, JSON.stringify(syncStatus));
      }
    } catch (error) {
      console.error(`Error checking sync status for sender ${sender.address}:`, error);
    }
  }

  /**
   * Call relayState() on the RegistryStateSender contract
   */
  private async relayState(sender: SenderConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      // Add to transaction queue to make sure that transactions are processed sequentially and there are no nonce conflicts
      this.transactionQueue.push({
        senderAddress: sender.address,
        resolve,
        reject,
      });

      // Start processing if not already processing
      if (!this.processingPromise) {
        this.processingPromise = this.processTransactionQueue().finally(() => {
          this.processingPromise = null;
        });
      }
    });
  }

  /**
   * Process transactions from the queue sequentially
   */
  private async processTransactionQueue(): Promise<void> {
    while (this.transactionQueue.length > 0) {
      const queueItem = this.transactionQueue.shift()!;

      try {
        console.log(`Calling relayState() for sender ${queueItem.senderAddress}...`);

        // First, get the quote for the relay fee
        const fee = await this.publicClient.readContract({
          address: queueItem.senderAddress,
          abi: registryStateSenderArtifact.abi,
          functionName: 'quoteRelayFee',
          args: [],
        });

        console.log(`Estimated relay fee for sender ${queueItem.senderAddress}: ${fee} wei`);

        // Call relayState with the estimated fee
        const hash = await this.walletClient.writeContract({
          address: queueItem.senderAddress,
          abi: registryStateSenderArtifact.abi,
          functionName: 'relayState',
          args: [],
          value: fee as bigint,
          account: this.account,
          chain: null,
        });

        console.log(`Relay transaction submitted for sender ${queueItem.senderAddress}: ${hash}`);

        // Wait for confirmation
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        console.log(`Relay transaction confirmed in block ${receipt.blockNumber} for sender ${queueItem.senderAddress}`);

        if (receipt.status === 'success') {
          console.log(`State relay successful for sender ${queueItem.senderAddress}`);
          queueItem.resolve(undefined);
        } else {
          const error = new Error(`State relay failed for sender ${queueItem.senderAddress}`);
          console.error(error.message);
          queueItem.reject(error);
        }
      } catch (error) {
        console.error(`Error calling relayState() for sender ${queueItem.senderAddress}:`, error);
        queueItem.reject(error);
      }
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
