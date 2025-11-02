/**
 * Socket client interface and Unix socket implementation for Mac
 */

import * as net from 'net';
import { TeeRequest, TeeResponse, VsockConfig } from '../types';
import { VsocketError } from '../utils/errors';
import { retryWithBackoff } from '../utils/retry';
import logger from '../utils/logger';

export interface SocketClient {
  connect(): Promise<void>;
  sendRequest(req: TeeRequest): Promise<TeeResponse>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * Unix socket client for Mac development
 * Uses Unix domain sockets instead of vsocket
 */
export class UnixSocketClient implements SocketClient {
  private socket?: net.Socket;
  private connected: boolean = false;
  private readonly socketPath: string;
  private readonly config: VsockConfig;

  constructor(config: VsockConfig, socketPath: string = '/tmp/enclave.sock') {
    this.config = config;
    this.socketPath = socketPath;
  }

  async connect(): Promise<void> {
    logger.info('Connecting to enclave via Unix socket', {
      socketPath: this.socketPath,
    });

    return retryWithBackoff(
      async () => {
        return new Promise((resolve, reject) => {
          this.socket = net.connect(this.socketPath);

          this.socket.on('connect', () => {
            this.connected = true;
            logger.info('Connected to enclave');
            resolve();
          });

          this.socket.on('error', (error) => {
            this.connected = false;
            reject(new VsocketError(`Connection failed: ${error.message}`));
          });

          this.socket.on('close', () => {
            this.connected = false;
            logger.warn('Connection to enclave closed');
          });

          // Timeout
          setTimeout(() => {
            if (!this.connected) {
              this.socket?.destroy();
              reject(new VsocketError('Connection timeout'));
            }
          }, this.config.timeoutMs);
        });
      },
      {
        maxAttempts: this.config.retryAttempts,
        delayMs: this.config.retryDelayMs,
        backoffMultiplier: 2,
        onRetry: (attempt, error) => {
          logger.warn('Connection retry', { attempt, error: error.message });
        },
      }
    );
  }

  async sendRequest(req: TeeRequest): Promise<TeeResponse> {
    if (!this.connected || !this.socket) {
      throw new VsocketError('Not connected to enclave');
    }

    logger.debug('Sending request to enclave', { id: req.id, method: req.method });

    // Write request
    await this.writeMessage(req);

    // Read response
    const response = await this.readMessage();

    logger.debug('Received response from enclave', {
      id: response.id,
      success: response.success,
    });

    return response;
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.end();
      this.connected = false;
      logger.info('Disconnected from enclave');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Write length-prefixed message to socket
   * Format: [4 bytes: length (big-endian)][N bytes: JSON]
   */
  private async writeMessage(msg: TeeRequest): Promise<void> {
    if (!this.socket) {
      throw new VsocketError('Socket not available');
    }

    // Serialize to JSON
    const json = JSON.stringify(msg);
    const jsonBuffer = Buffer.from(json, 'utf-8');

    // Create length buffer (4 bytes, big-endian)
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(jsonBuffer.length, 0);

    // Write length then JSON
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new VsocketError('Socket not available'));
        return;
      }

      this.socket.write(lengthBuffer, (err) => {
        if (err) {
          reject(new VsocketError(`Write failed: ${err.message}`));
          return;
        }

        this.socket!.write(jsonBuffer, (err) => {
          if (err) {
            reject(new VsocketError(`Write failed: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Read length-prefixed message from socket
   * Format: [4 bytes: length (big-endian)][N bytes: JSON]
   */
  private async readMessage(): Promise<TeeResponse> {
    if (!this.socket) {
      throw new VsocketError('Socket not available');
    }

    // Read 4-byte length
    const lengthBuffer = await this.readExactly(4);
    const length = lengthBuffer.readUInt32BE(0);

    logger.debug('Reading message', { length });

    // Read N bytes
    const dataBuffer = await this.readExactly(length);

    // Parse JSON
    try {
      return JSON.parse(dataBuffer.toString('utf-8')) as TeeResponse;
    } catch (error) {
      throw new VsocketError(`JSON parse failed: ${(error as Error).message}`);
    }
  }

  /**
   * Read exactly N bytes from socket
   */
  private async readExactly(bytes: number): Promise<Buffer> {
    if (!this.socket) {
      throw new VsocketError('Socket not available');
    }

    const buffer = Buffer.allocUnsafe(bytes);
    let offset = 0;

    while (offset < bytes) {
      const chunk = this.socket.read(bytes - offset) as Buffer | null;

      if (chunk === null) {
        // Wait for readable event
        await new Promise((resolve) => this.socket!.once('readable', resolve));
        continue;
      }

      chunk.copy(buffer, offset);
      offset += chunk.length;
    }

    return buffer;
  }
}

// TODO: Implement VsocketClient for Linux (uses vsock package)
// export class VsocketClient implements SocketClient { ... }
