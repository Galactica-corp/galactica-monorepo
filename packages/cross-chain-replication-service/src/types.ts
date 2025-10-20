import type { Address } from 'viem';

/**
 * Configuration for a single sender
 */
export type SenderConfig = {
  /** Address of the RegistryStateSender contract */
  address: Address;
  /** Polling interval in milliseconds for checking sync status */
  pollingInterval: number;
  /** Minimum threshold for merkleRootsLengthDiff to trigger relay */
  merkleRootsLengthDiffThreshold: bigint;
  /** Minimum threshold for queuePointerDiff to trigger relay */
  queuePointerDiffThreshold: bigint;
  /** Maximum delay in milliseconds before relaying small changes */
  maximumUpdateDelayMs: number;
};

/**
 * Configuration for the Cross-chain Replicator service
 */
export type ReplicatorConfig = {
  /** RPC URL for the source chain */
  rpcUrl: string;
  /** Private key for the account that will call relayState() */
  privateKey: `0x${string}`;
  /** Array of sender configurations */
  senders: SenderConfig[];
};

/**
 * Service state tracking
 */
export type ServiceState = {
  /** Last processed block number */
  lastProcessedBlock: bigint;
  /** Whether the service is currently running */
  isRunning: boolean;
  /** Number of events processed */
  eventsProcessed: number;
  /** Number of relayState calls made */
  relayCallsMade: number;
};
