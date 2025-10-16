import { readFileSync } from 'fs';
import { join } from 'path';
import type { Address } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import type { ReplicatorConfig, SenderConfig } from './types.js';

/**
 * Load configuration from environment variables and JSON config.
 *
 * @returns The configuration.
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

  // Load senders configuration from JSON file
  const sendersConfigPath = join(process.cwd(), 'config', 'senders.json');
  let senders: SenderConfig[];
  try {
    const sendersConfig = JSON.parse(readFileSync(sendersConfigPath, 'utf-8'));
    senders = sendersConfig.map((sender: any) => ({
      address: sender.address as Address,
      pollingInterval: sender.pollingInterval ?? 5000,
      merkleRootsLengthDiffThreshold: BigInt(
        sender.merkleRootsLengthDiffThreshold ?? 1,
      ),
      queuePointerDiffThreshold: BigInt(sender.queuePointerDiffThreshold ?? 1),
      maximumUpdateDelayMs: sender.maximumUpdateDelayMs ?? 300000,
    }));
  } catch (error) {
    throw new Error(
      `Failed to load senders configuration from ${sendersConfigPath}: ${error}`,
    );
  }

  if (senders.length === 0) {
    throw new Error('At least one sender must be configured in senders.json');
  }

  return {
    rpcUrl,
    privateKey: privateKey as `0x${string}`,
    senders,
  };
}

/**
 * Create viem clients from configuration.
 *
 * @param config - The configuration.
 * @returns The viem clients.
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
