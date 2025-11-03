#!/usr/bin/env ts-node
/**
 * Standalone Mock Enclave Server
 * Run this to manually test the host against a mock enclave
 *
 * Usage: npm run mock:enclave
 */

import { MockEnclave } from '../test/helpers/mock-enclave';

async function main() {
  console.log('Starting mock enclave server...');

  const enclave = new MockEnclave({
    socketPath: '/tmp/enclave.sock',
    publicKey: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    autoSign: true,
    attestationDoc: 'mock-nitro-attestation-document-v1',
  });

  try {
    await enclave.start();
    console.log('\nMock enclave is ready!');
    console.log('Socket path: /tmp/enclave.sock');
    console.log('\nSupported methods:');
    console.log('  - ping');
    console.log('  - get_public_key');
    console.log('  - sign_transaction');
    console.log('  - get_attestation');
    console.log('  - execute');
    console.log('\nPress Ctrl+C to stop\n');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down mock enclave...');
      await enclave.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down mock enclave...');
      await enclave.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start mock enclave:', error);
    process.exit(1);
  }
}

main();
