/**
 * Mock Enclave Server for Testing
 * This simulates the Rust enclave for host development
 */
import * as net from 'net';
import * as fs from 'fs';

interface TeeRequest {
  id: string;
  method: string;
  params: any;
  timestamp: number;
}

interface TeeResponse {
  id: string;
  success: boolean;
  data?: any;
  signature?: string;
  error?: string;
}

const SOCKET_PATH = '/tmp/enclave.sock';

// Remove existing socket
try {
  fs.unlinkSync(SOCKET_PATH);
} catch (e) {
  // Ignore if doesn't exist
}

console.log('🚀 Starting Mock Enclave Server');
console.log('═══════════════════════════════════════════');

const server = net.createServer((socket) => {
  console.log('✓ Client connected');

  let buffer = Buffer.alloc(0);

  socket.on('data', async (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Try to read length-prefixed messages
    while (buffer.length >= 4) {
      const length = buffer.readUInt32BE(0);

      if (buffer.length < 4 + length) {
        // Not enough data yet
        break;
      }

      // Extract message
      const messageBuffer = buffer.slice(4, 4 + length);
      buffer = buffer.slice(4 + length);

      // Parse request
      try {
        const request: TeeRequest = JSON.parse(messageBuffer.toString('utf-8'));
        console.log(`\n→ Request [${request.method}]:`, request);

        // Generate mock response based on method
        let response: TeeResponse;

        switch (request.method) {
          case 'get_price':
            const symbol = request.params?.symbol || 'BTCUSDT';
            response = {
              id: request.id,
              success: true,
              data: {
                symbol,
                price: (Math.random() * 50000 + 40000).toFixed(2),
                timestamp: Date.now(),
                source: 'mock-enclave'
              },
              signature: '0xmock' + Math.random().toString(16).substring(2, 66),
            };
            break;

          case 'get_attestation':
            response = {
              id: request.id,
              success: true,
              data: {
                attestation_document: 'mock-attestation-base64',
                public_key: '0x04' + '0'.repeat(128),
                pcrs: {
                  pcr0: 'mock-pcr0',
                  pcr1: 'mock-pcr1',
                  pcr2: 'mock-pcr2'
                }
              },
            };
            break;

          default:
            response = {
              id: request.id,
              success: false,
              error: `Unknown method: ${request.method}`,
            };
        }

        // Send response
        const responseJson = JSON.stringify(response);
        const responseBuffer = Buffer.from(responseJson, 'utf-8');
        const lengthBuffer = Buffer.allocUnsafe(4);
        lengthBuffer.writeUInt32BE(responseBuffer.length, 0);

        socket.write(lengthBuffer);
        socket.write(responseBuffer);

        console.log(`✓ Response [${response.success ? 'SUCCESS' : 'ERROR'}]:`, response);
      } catch (error) {
        console.error('✗ Error parsing request:', error);
      }
    }
  });

  socket.on('end', () => {
    console.log('✗ Client disconnected');
  });

  socket.on('error', (error) => {
    console.error('✗ Socket error:', error);
  });
});

server.listen(SOCKET_PATH, () => {
  console.log(`\n✓ Mock enclave listening on ${SOCKET_PATH}`);
  console.log('✓ Ready to accept connections');
  console.log('\nSupported methods:');
  console.log('  - get_price (params: {symbol: string})');
  console.log('  - get_attestation');
  console.log('\nPress Ctrl+C to stop\n');
  console.log('═══════════════════════════════════════════');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down mock enclave...');
  server.close(() => {
    try {
      fs.unlinkSync(SOCKET_PATH);
    } catch (e) {}
    console.log('✓ Stopped');
    process.exit(0);
  });
});
