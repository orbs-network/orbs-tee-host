/**
 * Mock Enclave Server for Testing
 * Simulates an AWS Nitro enclave by listening on Unix socket
 * and responding to TeeRequest messages with TeeResponse
 */

import * as net from 'net';
import * as fs from 'fs';
import { TeeRequest, TeeResponse } from '../../src/types';

export interface MockEnclaveConfig {
  socketPath?: string;
  publicKey?: string;
  autoSign?: boolean;
  attestationDoc?: string;
}

export class MockEnclave {
  private server: net.Server | null = null;
  private connections: Set<net.Socket> = new Set();
  private config: Required<MockEnclaveConfig>;
  private requestCount = 0;

  constructor(config: MockEnclaveConfig = {}) {
    this.config = {
      socketPath: config.socketPath || '/tmp/enclave.sock',
      publicKey:
        config.publicKey ||
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      autoSign: config.autoSign ?? true,
      attestationDoc: config.attestationDoc || 'mock-attestation-document',
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean up existing socket
      if (fs.existsSync(this.config.socketPath)) {
        fs.unlinkSync(this.config.socketPath);
      }

      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (error) => {
        reject(error);
      });

      this.server.listen(this.config.socketPath, () => {
        console.log(`Mock enclave listening on ${this.config.socketPath}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all connections
      for (const socket of this.connections) {
        socket.destroy();
      }
      this.connections.clear();

      if (this.server) {
        this.server.close(() => {
          // Clean up socket file
          if (fs.existsSync(this.config.socketPath)) {
            fs.unlinkSync(this.config.socketPath);
          }
          console.log('Mock enclave stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  resetRequestCount(): void {
    this.requestCount = 0;
  }

  private handleConnection(socket: net.Socket): void {
    this.connections.add(socket);
    console.log('Mock enclave: Client connected');

    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      // Process all complete messages in buffer
      while (buffer.length >= 4) {
        // Read length prefix
        const messageLength = buffer.readUInt32BE(0);

        // Check if we have the complete message
        if (buffer.length >= 4 + messageLength) {
          // Extract message
          const messageBuffer = buffer.slice(4, 4 + messageLength);
          buffer = buffer.slice(4 + messageLength);

          // Process message
          try {
            const request: TeeRequest = JSON.parse(
              messageBuffer.toString('utf-8')
            );
            console.log('Mock enclave received request:', request.method);
            this.requestCount++;

            const response = this.handleRequest(request);
            this.sendResponse(socket, response);
          } catch (error) {
            console.error('Mock enclave: Error processing request:', error);
            const errorResponse: TeeResponse = {
              id: 'unknown',
              success: false,
              error: (error as Error).message,
            };
            this.sendResponse(socket, errorResponse);
          }
        } else {
          // Wait for more data
          break;
        }
      }
    });

    socket.on('end', () => {
      console.log('Mock enclave: Client disconnected');
      this.connections.delete(socket);
    });

    socket.on('error', (error) => {
      console.error('Mock enclave: Socket error:', error);
      this.connections.delete(socket);
    });
  }

  private handleRequest(request: TeeRequest): TeeResponse {
    const baseResponse: TeeResponse = {
      id: request.id,
      success: true,
    };

    switch (request.method) {
      case 'get_public_key':
        return {
          ...baseResponse,
          data: {
            publicKey: this.config.publicKey,
          },
        };

      case 'sign_transaction':
        if (!this.config.autoSign) {
          return {
            ...baseResponse,
            success: false,
            error: 'Auto-signing disabled',
          };
        }
        return {
          ...baseResponse,
          data: {
            signature: this.mockSign(request.params?.data || ''),
          },
          signature: this.mockSign(
            JSON.stringify({
              id: request.id,
              method: request.method,
              params: request.params,
            })
          ),
        };

      case 'get_attestation':
        return {
          ...baseResponse,
          data: {
            attestationDoc: Buffer.from(this.config.attestationDoc).toString(
              'base64'
            ),
            certificateChain: [
              Buffer.from('mock-cert-1').toString('base64'),
              Buffer.from('mock-cert-2').toString('base64'),
            ],
            publicKey: this.config.publicKey,
          },
          signature: this.mockSign(this.config.attestationDoc),
        };

      case 'execute':
        return {
          ...baseResponse,
          data: {
            result: `Executed: ${JSON.stringify(request.params)}`,
          },
          signature: this.mockSign(JSON.stringify(request.params)),
        };

      case 'ping':
        return {
          ...baseResponse,
          data: {
            pong: true,
            timestamp: Date.now(),
          },
        };

      default:
        return {
          ...baseResponse,
          success: false,
          error: `Unknown method: ${request.method}`,
        };
    }
  }

  private mockSign(data: string): string {
    // Simple mock signature: hash of data + public key
    const crypto = require('crypto');
    const hash = crypto
      .createHash('sha256')
      .update(data + this.config.publicKey)
      .digest('hex');
    return `0x${hash}`;
  }

  private sendResponse(socket: net.Socket, response: TeeResponse): void {
    const json = JSON.stringify(response);
    const jsonBuffer = Buffer.from(json, 'utf-8');

    // Create length prefix (4 bytes, big-endian)
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(jsonBuffer.length, 0);

    // Send length + message
    socket.write(Buffer.concat([lengthBuffer, jsonBuffer]));
    console.log(
      'Mock enclave sent response:',
      response.success ? 'success' : 'error'
    );
  }
}
