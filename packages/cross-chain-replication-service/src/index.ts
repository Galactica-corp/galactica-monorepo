#!/usr/bin/env node

import { config } from 'dotenv';
import { join } from 'path';

// Load .env file from the service directory
const envPath = join(process.cwd(), '.env');
config({ path: envPath });
import { loadConfig, createClients } from './config';
import { CrossChainReplicator } from './replicator';

/**
 * Main entry point for the Cross-chain Replicator service
 */
async function main() {
  try {
    console.log('Starting Cross-chain Replicator Service...');

    // Load configuration
    const config = loadConfig();
    console.log('Configuration loaded successfully');

    // Create viem clients
    const { publicClient, walletClient, account } = createClients(config);
    console.log(`Using account: ${account.address}`);

    // Create and start the replicator
    const replicator = new CrossChainReplicator(
      publicClient,
      walletClient,
      account,
      config.senderAddress
    );

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      await replicator.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM, shutting down gracefully...');
      await replicator.stop();
      process.exit(0);
    });

    // Start the service
    await replicator.start();

    console.log('Cross-chain Replicator Service started successfully');
    console.log(`Will call relayState on: ${config.senderAddress}`);
    console.log('Press Ctrl+C to stop the service');

    // Keep the process running
    while (replicator.isServiceRunning) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } catch (error) {
    console.error('Error starting Cross-chain Replicator Service:', error);
    process.exit(1);
  }
}

// Run the service
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
