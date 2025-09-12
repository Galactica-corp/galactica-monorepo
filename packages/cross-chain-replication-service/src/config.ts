import { ReplicatorConfig } from './types.js';
import { createPublicClient, createWalletClient, http, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Load configuration from environment variables
 */
export function loadConfig(): ReplicatorConfig {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error('RPC_URL environment variable is required');
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  if (!privateKey.startsWith('0x')) {
    throw new Error('PRIVATE_KEY must start with 0x');
  }

  const senderAddress = process.env.SENDER_ADDRESS;
  if (!senderAddress) {
    throw new Error('SENDER_ADDRESS environment variable is required');
  }

  const pollingInterval = process.env.POLLING_INTERVAL ? parseInt(process.env.POLLING_INTERVAL) : 5000;

  return {
    rpcUrl,
    privateKey: privateKey as `0x${string}`,
    senderAddress: senderAddress as Address,
    pollingInterval,
  };
}

/**
 * Create viem clients from configuration
 */
export function createClients(config: ReplicatorConfig): {
  publicClient: any;
  walletClient: any;
  account: any;
} {
  const account = privateKeyToAccount(config.privateKey);

  const publicClient = createPublicClient({
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    transport: http(config.rpcUrl),
  });

  return { publicClient, walletClient, account };
}
