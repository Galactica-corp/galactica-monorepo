import { Address } from 'viem';

/**
 * Configuration for a single sender
 */
export interface SenderConfig {
  /** Address of the RegistryStateSender contract */
  address: Address;
  /** Polling interval in milliseconds for checking sync status */
  pollingInterval: number;
}

/**
 * Configuration for the Cross-chain Replicator service
 */
export interface ReplicatorConfig {
  /** RPC URL for the source chain */
  rpcUrl: string;
  /** Private key for the account that will call relayState() */
  privateKey: `0x${string}`;
  /** Array of sender configurations */
  senders: SenderConfig[];
}

/**
 * Event emitted when a certificate is added to the registry
 */
export interface ZkCertificateAdditionEvent {
  eventName: 'zkCertificateAddition';
  args: {
    zkCertificateLeafHash: `0x${string}`;
    Guardian: Address;
    index: bigint;
  };
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}

/**
 * Event emitted when a certificate is revoked from the registry
 */
export interface ZkCertificateRevocationEvent {
  eventName: 'zkCertificateRevocation';
  args: {
    zkCertificateLeafHash: `0x${string}`;
    Guardian: Address;
    index: bigint;
  };
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}

/**
 * Union type for all registry events we want to monitor
 */
export type RegistryEvent = ZkCertificateAdditionEvent | ZkCertificateRevocationEvent;

/**
 * Service state tracking
 */
export interface ServiceState {
  /** Last processed block number */
  lastProcessedBlock: bigint;
  /** Whether the service is currently running */
  isRunning: boolean;
  /** Number of events processed */
  eventsProcessed: number;
  /** Number of relayState calls made */
  relayCallsMade: number;
}
