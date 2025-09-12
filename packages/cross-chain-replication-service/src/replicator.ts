import {
  PublicClient,
  WalletClient,
  Address,
  zeroAddress
} from 'viem';

import registryStateSenderArtifact from '@galactica-net/cross-chain-replication-contracts/artifacts/contracts/RegistryStateSender.sol/RegistryStateSender.json';

/**
 * Sync status returned by the RegistryStateSender contract
 */
interface SyncStatus {
  merkleRootsLengthDiff: bigint;
  hasNewRevocation: boolean;
  queuePointerDiff: bigint;
}

/**
 * Cross-chain Replicator Service
 * Periodically checks sync status and relays state changes to destination chains
 */
export class CrossChainReplicator {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: any;
  private registryAddress: Address = zeroAddress;
  private senderAddress: Address;
  private pollingInterval: number;
  private pollTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    account: any,
    senderAddress: Address,
    pollingInterval: number = 5000
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.account = account;
    this.senderAddress = senderAddress;
    this.pollingInterval = pollingInterval;
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
    console.log(`Starting Cross-chain Replicator with ${this.pollingInterval}ms polling interval`);

    this.registryAddress = await this.publicClient.readContract({
      address: this.senderAddress,
      abi: registryStateSenderArtifact.abi,
      functionName: 'registry',
      args: [],
    }) as Address;

    // Start periodic polling
    this.pollTimer = setInterval(async () => {
      try {
        await this.checkSyncStatus();
      } catch (error) {
        console.error('Error during sync status check:', error);
        // In a production service, you might want to implement retry logic here
      }
    }, this.pollingInterval);

    // Perform initial check immediately
    await this.checkSyncStatus();
  }

  /**
   * Stop the replicator service
   */
  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    this.isRunning = false;
    console.log('Cross-chain Replicator stopped');
  }

  /**
   * Check sync status and relay state if needed
   */
  private async checkSyncStatus(): Promise<void> {
    try {
      // Get sync status from the RegistryStateSender contract
      const syncResponse = await this.publicClient.readContract({
        address: this.senderAddress,
        abi: registryStateSenderArtifact.abi,
        functionName: 'getSyncStatus',
        args: [],
      }) as [bigint, boolean, bigint];

      const syncStatus: SyncStatus = {
        merkleRootsLengthDiff: syncResponse[0],
        hasNewRevocation: syncResponse[1],
        queuePointerDiff: syncResponse[2],
      };

      console.log('Sync status check:', {
        merkleRootsLengthDiff: syncStatus.merkleRootsLengthDiff.toString(),
        hasNewRevocation: syncStatus.hasNewRevocation,
        queuePointerDiff: syncStatus.queuePointerDiff.toString(),
      });

      // Check if there's anything to sync
      const hasNewAdditions = syncStatus.merkleRootsLengthDiff > 0n;
      const hasNewRevocations = syncStatus.hasNewRevocation;
      const hasQueueUpdates = syncStatus.queuePointerDiff > 0n;

      if (hasNewAdditions || hasNewRevocations || hasQueueUpdates) {
        console.log('Detected changes in registry state, triggering relay...');
        await this.relayState();
      } else {
        console.log('No new changes detected');
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
      // In production, you might want to implement error handling and retry logic
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
