import registryStateSenderArtifact from '@galactica-net/cross-chain-replication-contracts/artifacts/contracts/RegistryStateSender.sol/RegistryStateSender.json';
import type { PublicClient, WalletClient, Address } from 'viem';

import type { SenderConfig } from './types.js';

/**
 * Sync status returned by the RegistryStateSender contract
 */
type SyncStatus = {
  merkleRootsLengthDiff: bigint;
  hasNewRevocation: boolean;
  queuePointerDiff: bigint;
};

/**
 * Transaction queue item
 */
type TransactionQueueItem = {
  senderAddress: Address;
  resolve: (value: any) => void;
  reject: (error: any) => void;
};

/**
 * Cross-chain Replicator Service
 * Periodically checks sync status and relays state changes to destination chains
 */
export class CrossChainReplicator {
  readonly #publicClient: PublicClient;

  readonly #walletClient: WalletClient;

  readonly #account: any;

  readonly #senders: SenderConfig[];

  readonly #pollTimers: Map<Address, NodeJS.Timeout> = new Map();

  readonly #delayedRelayTimers: Map<Address, NodeJS.Timeout> = new Map();

  #isRunning = false;

  readonly #transactionQueue: TransactionQueueItem[] = [];

  #processingPromise: Promise<void> | null = null;

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    account: any,
    senders: SenderConfig[],
  ) {
    this.#publicClient = publicClient;
    this.#walletClient = walletClient;
    this.#account = account;
    this.#senders = senders;
  }

  /**
   * Start the replicator service
   */
  async start(): Promise<void> {
    if (this.#isRunning) {
      console.log('Replicator is already running');
      return;
    }

    this.#isRunning = true;
    console.log(
      `Starting Cross-chain Replicator for ${this.#senders.length} sender(s)`,
    );

    // Start polling for each sender
    for (const sender of this.#senders) {
      console.log(
        `Starting polling for sender ${sender.address} with ${sender.pollingInterval}ms interval`,
      );

      // Perform initial check immediately
      try {
        await this.#checkSyncStatus(sender);
      } catch (error) {
        console.error(
          `Error during initial sync status check for sender ${sender.address}:`,
          error,
        );
      }

      // Start periodic polling
      const timer = setInterval(() => {
        (async () => {
          try {
            await this.#checkSyncStatus(sender);
          } catch (error) {
            console.error(
              `Error during sync status check for sender ${sender.address}:`,
              error,
            );
            // In a production service, you might want to implement retry logic here
          }
        })().catch(() => {
          // Ignore unhandled promise rejections in setInterval callbacks
        });
      }, sender.pollingInterval);

      this.#pollTimers.set(sender.address, timer);
    }
  }

  /**
   * Stop the replicator service
   */
  async stop(): Promise<void> {
    // Clear all polling timers
    for (const [address, timer] of this.#pollTimers) {
      clearInterval(timer);
      console.log(`Stopped polling for sender ${address}`);
    }
    this.#pollTimers.clear();

    // Clear all delayed relay timers
    for (const [address, timer] of this.#delayedRelayTimers) {
      clearTimeout(timer);
      console.log(`Cleared delayed relay timer for sender ${address}`);
    }
    this.#delayedRelayTimers.clear();

    this.#isRunning = false;
    console.log('Cross-chain Replicator stopped');
  }

  /**
   * Check sync status and relay state if needed
   *
   * @param sender - The sender configuration.
   * @returns void.
   */
  async #checkSyncStatus(sender: SenderConfig): Promise<void> {
    try {
      // Get sync status from the RegistryStateSender contract
      const syncResponse = (await this.#publicClient.readContract({
        address: sender.address,
        abi: registryStateSenderArtifact.abi,
        functionName: 'getSyncStatus',
        args: [],
      })) as [bigint, boolean, bigint];

      const syncStatus: SyncStatus = {
        merkleRootsLengthDiff: syncResponse[0],
        hasNewRevocation: syncResponse[1],
        queuePointerDiff: syncResponse[2],
      };

      // Check if there's anything to sync based on configured thresholds
      const hasNewAdditions =
        syncStatus.merkleRootsLengthDiff >=
        sender.merkleRootsLengthDiffThreshold;
      const hasNewRevocations = syncStatus.hasNewRevocation;
      const hasQueueUpdates =
        syncStatus.queuePointerDiff >= sender.queuePointerDiffThreshold;
      const hasAnyChanges =
        syncStatus.merkleRootsLengthDiff > 0n ||
        syncStatus.hasNewRevocation ||
        syncStatus.queuePointerDiff > 0n;

      if (hasNewAdditions || hasNewRevocations || hasQueueUpdates) {
        console.log(
          `Detected changes meeting thresholds for sender ${sender.address}, ${this.#syncStatusToLogString(syncStatus)}, triggering immediate relay...`,
        );
        // Clear any existing delayed timer since we're relaying now
        this.#clearDelayedTimer(sender.address);
        await this.#relayState(sender);
      } else if (hasAnyChanges) {
        // Set up delayed relay timer if not already set
        if (!this.#delayedRelayTimers.has(sender.address)) {
          console.log(
            `Changes detected but below thresholds for sender ${sender.address}, ${this.#syncStatusToLogString(syncStatus)}, scheduling delayed relay in ${sender.maximumUpdateDelayMs}ms`,
          );
          this.#scheduleDelayedRelay(sender);
        }
      } else {
        console.log(
          `No changes detected for sender ${sender.address}, ${this.#syncStatusToLogString(syncStatus)}`,
        );
        // Clear any existing delayed timer since there are no changes
        this.#clearDelayedTimer(sender.address);
      }
    } catch (error) {
      console.error(
        `Error checking sync status for sender ${sender.address}:`,
        error,
      );
    }
  }

  /**
   * Call relayState() on the RegistryStateSender contract.
   *
   * @param sender - The sender configuration.
   */
  async #relayState(sender: SenderConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      // Add to transaction queue to make sure that transactions are processed sequentially and there are no nonce conflicts
      this.#transactionQueue.push({
        senderAddress: sender.address,
        resolve,
        reject,
      });

      // Start processing if not already processing
      if (!this.#processingPromise) {
        this.#processingPromise = this.#processTransactionQueue().finally(
          () => {
            this.#processingPromise = null;
          },
        );
      }
    });
  }

  /**
   * Process transactions from the queue sequentially.
   */
  async #processTransactionQueue(): Promise<void> {
    while (this.#transactionQueue.length > 0) {
      const queueItem = this.#transactionQueue.shift();
      if (!queueItem) {
        break;
      }

      try {
        console.log(
          `Calling relayState() for sender ${queueItem.senderAddress}...`,
        );

        // First, get the quote for the relay fee
        const fee = await this.#publicClient.readContract({
          address: queueItem.senderAddress,
          abi: registryStateSenderArtifact.abi,
          functionName: 'quoteRelayFee',
          args: [],
        });

        console.log(
          `Estimated relay fee for sender ${queueItem.senderAddress}: ${String(fee)} wei`,
        );

        // Call relayState with the estimated fee
        const hash = await this.#walletClient.writeContract({
          address: queueItem.senderAddress,
          abi: registryStateSenderArtifact.abi,
          functionName: 'relayState',
          args: [],
          value: fee as bigint,
          account: this.#account,
          chain: null,
        });

        console.log(
          `Relay transaction submitted for sender ${queueItem.senderAddress}: ${hash}`,
        );

        // Wait for confirmation
        const receipt = await this.#publicClient.waitForTransactionReceipt({
          hash,
        });
        console.log(
          `Relay transaction confirmed in block ${receipt.blockNumber} for sender ${queueItem.senderAddress}`,
        );

        if (receipt.status === 'success') {
          console.log(
            `State relay successful for sender ${queueItem.senderAddress}`,
          );
          queueItem.resolve(undefined);
        } else {
          const error = new Error(
            `State relay failed for sender ${queueItem.senderAddress}`,
          );
          console.error(error.message);
          queueItem.reject(error);
        }
      } catch (error) {
        console.error(
          `Error calling relayState() for sender ${queueItem.senderAddress}:`,
          error,
        );
        queueItem.reject(error);
      }
    }
  }

  /**
   * Check if the service is running.
   *
   * @returns Whether the service is running.
   */
  get isServiceRunning(): boolean {
    return this.#isRunning;
  }

  /**
   * Clear any existing delayed relay timer for a sender.
   *
   * @param senderAddress - The address of the sender.
   */
  #clearDelayedTimer(senderAddress: Address): void {
    const existingTimer = this.#delayedRelayTimers.get(senderAddress);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.#delayedRelayTimers.delete(senderAddress);
      console.log(
        `Cleared existing delayed relay timer for sender ${senderAddress}`,
      );
    }
  }

  /**
   * Schedule a delayed relay for a sender if not already scheduled.
   *
   * @param sender - The sender configuration.
   */
  #scheduleDelayedRelay(sender: SenderConfig): void {
    // Don't schedule if there's already a timer for this sender
    if (this.#delayedRelayTimers.has(sender.address)) {
      return;
    }

    console.log(
      `Scheduling delayed relay for sender ${sender.address} in ${sender.maximumUpdateDelayMs}ms`,
    );
    const timer = setTimeout(() => {
      (async () => {
        try {
          console.log(
            `Delayed relay timer expired for sender ${sender.address}, triggering relay...`,
          );
          // Remove the timer from the map since it's firing
          this.#delayedRelayTimers.delete(sender.address);
          await this.#relayState(sender);
        } catch (error) {
          console.error(
            `Error during delayed relay for sender ${sender.address}:`,
            error,
          );
          // Remove the timer from the map even if there was an error
          this.#delayedRelayTimers.delete(sender.address);
        }
      })().catch(() => {
        // Ignore unhandled promise rejections in setTimeout callbacks
      });
    }, sender.maximumUpdateDelayMs);

    this.#delayedRelayTimers.set(sender.address, timer);
  }

  /**
   * Convert sync status to a string for logging.
   *
   * @param syncStatus - The sync status.
   * @returns The sync status as a string.
   */
  #syncStatusToLogString(syncStatus: SyncStatus): string {
    return `rootsDiff: ${syncStatus.merkleRootsLengthDiff}, newRevocation: ${syncStatus.hasNewRevocation}, queueDiff: ${syncStatus.queuePointerDiff}`;
  }
}
