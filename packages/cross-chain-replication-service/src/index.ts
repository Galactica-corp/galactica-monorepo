#!/usr/bin/env node

import { config } from 'dotenv';
import { join } from 'path';

import { loadConfig, createClients } from './config';
import { CrossChainReplicator } from './replicator';

// Load .env file from the service directory
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

/**
 * Main entry point for the Cross-chain Replicator service
 */
async function main() {
  try {
    console.log('Starting Cross-chain Replicator Service...');

    // Load configuration
    const serviceConfig = loadConfig();
    console.log('Configuration loaded successfully');

    // Create viem clients
    const { publicClient, walletClient, account } =
      createClients(serviceConfig);
    console.log(`Using account: ${account.address}`);

    // Create and start the replicator
    const replicator = new CrossChainReplicator(
      publicClient,
      walletClient,
      account,
      serviceConfig.senders,
    );

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      (async () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        await replicator.stop();
        process.exit(0);
      })().catch(() => {
        // Ignore unhandled promise rejections in signal handlers
      });
    });

    process.on('SIGTERM', () => {
      (async () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        await replicator.stop();
        process.exit(0);
      })().catch(() => {
        // Ignore unhandled promise rejections in signal handlers
      });
    });

    // Start the service
    await replicator.start();

    console.log('Cross-chain Replicator Service started successfully');
    console.log(`Configured ${serviceConfig.senders.length} sender(s):`);
    serviceConfig.senders.forEach((sender) => {
      console.log(
        `${sender.address} (polling: ${sender.pollingInterval}ms, merkleRootsLengthDiffThreshold: ${sender.merkleRootsLengthDiffThreshold}, queuePointerDiffThreshold: ${sender.queuePointerDiffThreshold}, maximumUpdateDelayMs: ${sender.maximumUpdateDelayMs})`,
      );
    });
    console.log('Press Ctrl+C to stop the service');

    // Keep the process running
    while (replicator.isServiceRunning) {
      await new Promise((resolve) => setTimeout(resolve, 500));
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
