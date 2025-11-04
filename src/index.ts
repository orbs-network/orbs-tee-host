/**
 * ORBS TEE Host - Main Entry Point
 *
 * This is the untrusted bridge component that connects DApps with TEE enclaves
 * running on AWS Nitro (and other TEE platforms).
 */

import { loadConfig } from './config';
import { UnixSocketClient } from './vsock/client';
import { L3Client } from './l3/client';
import { AuthModule } from './auth';
import { createServer, startServer } from './api/server';
import logger from './utils/logger';

async function main() {
  try {
    logger.info('Starting ORBS TEE Host');

    // Load configuration
    const config = loadConfig();

    // Initialize vsocket client (Use UnixSocketClient for testing with network)
    const vsockClient = new UnixSocketClient(config.vsock);

    logger.info('Connecting to enclave');
    await vsockClient.connect();

    // Initialize L3 client
    const l3Client = new L3Client(config.l3);

    // Initialize auth module
    const authModule = new AuthModule(config.auth);

    // Create HTTP API server
    const app = createServer(config.api, {
      vsockClient,
      l3Client,
      authModule,
      tappId: process.env.TAPP_ID || 'default', // TODO: Get from config
    });

    // Start server
    startServer(app, config.api);

    logger.info('ORBS TEE Host started successfully', {
      apiPort: config.api.port,
      vsockPort: config.vsock.port,
    });
  } catch (error) {
    logger.error('Failed to start ORBS TEE Host', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Start application
main();
