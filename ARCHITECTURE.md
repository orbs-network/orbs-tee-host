# ORBS TEE Host - Architecture (TypeScript)

This document describes the design and architecture of the ORBS TEE Host application built with TypeScript/Node.js.

## Table of Contents

- [Overview](#overview)
- [System Context](#system-context)
- [Component Architecture](#component-architecture)
- [Communication Protocols](#communication-protocols)
- [Data Flow](#data-flow)
- [TypeScript Implementation Details](#typescript-implementation-details)
- [Deployment Architecture](#deployment-architecture)

---

## Overview

The ORBS TEE Host is the **untrusted bridge component** that connects DApps with TEE enclaves. Built with **TypeScript/Node.js** for seamless integration with the ORBS ecosystem.

### Key Principles

- **Stateless** - No persistent state (except configuration)
- **Untrusted** - Cannot compromise enclave security
- **Observable** - Comprehensive logging and metrics
- **Resilient** - Automatic retries and error recovery
- **Cross-Platform** - Docker-based deployment
- **Type-Safe** - Leverages TypeScript for correctness

---

## System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                    DApp (TypeScript/Web3)                       │
│          - Smart Contract Consumer                              │
│          - Requests signed data from TEE                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTPS (REST API)
                         │ TLS Encrypted
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              ORBS TEE Host (TypeScript - THIS)                  │
│                  - Untrusted Bridge Component                   │
│                  - Request Forwarding                           │
│                  - Attestation Submission                       │
└───────────┬─────────────────────────────────────────┬───────────┘
            │                                         │
            │ vsocket/Unix socket                     │ HTTPS
            │ (CID=3, Port=3000)                      │
            ▼                                         ▼
┌──────────────────────────┐         ┌─────────────────────────────┐
│   TEE Enclave (Rust)     │         │  ORBS L3 Guardian Network   │
│   - Trusted Component    │         │  - 22 Independent Guardians │
│   - Business Logic       │         │  - Attestation Verification │
│   - Key Management       │         │  - M-of-N Consensus         │
│   - Response Signing     │         └─────────────┬───────────────┘
└──────────────────────────┘                       │
                                                   │ Submit Proof
                                                   ▼
                                    ┌────────────────────────────────┐
                                    │  On-Chain Registrar Contract   │
                                    │  - Stores Verified Public Keys │
                                    │  - Used by Smart Contracts     │
                                    └────────────────────────────────┘
```

---

## Component Architecture

### High-Level Components

```typescript
// Main Application
┌────────────────────────────────────────────────────────────────┐
│                      index.ts (Main Entry)                     │
├────────────────────────────────────────────────────────────────┤
│  ConfigLoader → Logger → VsockClient → L3Client → APIServer   │
└────────────────────────────────────────────────────────────────┘

// Module Structure
src/
├── index.ts                 // Bootstrap application
├── config/
│   └── index.ts            // Load config from JSON + env vars
├── vsock/
│   ├── client.ts           // Vsocket client (Linux)
│   └── unix-client.ts      // Unix socket client (Mac)
├── l3/
│   └── client.ts           // L3 guardian communication
├── auth/
│   └── index.ts            // DApp authentication (Phase 2)
├── api/
│   ├── server.ts           // Express/Fastify server
│   ├── routes/
│   │   ├── request.ts      // POST /api/v1/request
│   │   ├── attest.ts       // POST /api/v1/attest
│   │   ├── health.ts       // GET /api/v1/health
│   │   └── status.ts       // GET /api/v1/status
│   └── middleware/
│       ├── logging.ts      // Request/response logging
│       ├── auth.ts         // Authentication middleware
│       └── error.ts        // Error handling
├── types/
│   └── index.ts            // TypeScript interfaces
└── utils/
    ├── logger.ts           // Winston/Pino logger
    ├── errors.ts           // Custom error classes
    └── retry.ts            // Retry utilities
```

### Module Breakdown

#### 1. Configuration Module (`src/config/index.ts`)

```typescript
export interface Config {
  vsock: VsockConfig;
  l3: L3Config;
  api: ApiConfig;
  auth: AuthConfig;
  logging: LoggingConfig;
}

export interface VsockConfig {
  cid: number;              // Enclave CID (3 = parent)
  port: number;             // Enclave port
  timeoutMs: number;        // Connection timeout
  retryAttempts: number;    // Retry count
  retryDelayMs: number;     // Initial retry delay
}

export function loadConfig(): Config {
  // 1. Load from config.json
  // 2. Override with environment variables
  // 3. Validate with Joi/Zod
  // 4. Return typed config
}
```

#### 2. Vsocket Client Module (`src/vsock/client.ts`)

```typescript
export interface SocketClient {
  connect(): Promise<void>;
  sendRequest(req: TeeRequest): Promise<TeeResponse>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

// Linux implementation
export class VsockClient implements SocketClient {
  private socket?: net.Socket;

  async connect(): Promise<void> {
    // Connect to vsocket
  }

  async sendRequest(req: TeeRequest): Promise<TeeResponse> {
    // 1. Write length-prefixed request
    // 2. Read length-prefixed response
    // 3. Parse and return
  }

  private async writeMessage(msg: TeeRequest): Promise<void> {
    const json = JSON.stringify(msg);
    const jsonBuffer = Buffer.from(json, 'utf-8');
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(jsonBuffer.length, 0);

    await this.write(lengthBuffer);
    await this.write(jsonBuffer);
  }

  private async readMessage(): Promise<TeeResponse> {
    const lengthBuffer = await this.readExactly(4);
    const length = lengthBuffer.readUInt32BE(0);
    const dataBuffer = await this.readExactly(length);
    return JSON.parse(dataBuffer.toString('utf-8'));
  }
}

// Mac implementation
export class UnixSocketClient implements SocketClient {
  // Same interface, different transport
}
```

#### 3. L3 Client Module (`src/l3/client.ts`)

```typescript
export interface AttestationBundle {
  attestationDoc: Buffer;
  certificateChain: Buffer[];
  enclavePublicKey: string;
  tappId: string;
}

export interface AttestationSubmission {
  attestationId: string;
  submissionTime: Date;
  status: 'submitted' | 'pending' | 'verified' | 'failed';
}

export class L3Client {
  constructor(private config: L3Config) {}

  async submitAttestation(
    bundle: AttestationBundle
  ): Promise<AttestationSubmission> {
    // Try each guardian endpoint
    for (const endpoint of this.config.endpoints) {
      try {
        const response = await axios.post(`${endpoint}/attestation/submit`, {
          attestation_doc: bundle.attestationDoc.toString('base64'),
          certificate_chain: bundle.certificateChain.map(c => c.toString('base64')),
          enclave_public_key: bundle.enclavePublicKey,
          tapp_id: bundle.tappId,
        });

        return response.data;
      } catch (error) {
        // Try next guardian
        continue;
      }
    }

    throw new L3Error('All guardians unreachable');
  }

  async queryConsensusStatus(
    attestationId: string
  ): Promise<ConsensusStatus> {
    // Poll guardian for consensus status
  }
}
```

#### 4. HTTP API Server Module (`src/api/server.ts`)

```typescript
import express from 'express';

export function createServer(
  vsockClient: SocketClient,
  l3Client: L3Client,
  config: ApiConfig
): express.Application {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(loggingMiddleware());
  app.use(cors());
  app.use(errorMiddleware());

  // Routes
  app.post('/api/v1/request', handleRequest(vsockClient));
  app.post('/api/v1/attest', handleAttest(vsockClient, l3Client));
  app.get('/api/v1/health', handleHealth(vsockClient, l3Client));
  app.get('/api/v1/status', handleStatus());

  return app;
}

// Route handlers
function handleRequest(vsockClient: SocketClient) {
  return async (req: Request, res: Response) => {
    try {
      const dappRequest = req.body as DAppRequest;

      // Convert to TeeRequest
      const teeRequest: TeeRequest = {
        id: uuidv4(),
        method: dappRequest.method,
        params: dappRequest.params,
        timestamp: Date.now(),
      };

      // Forward to enclave
      const response = await vsockClient.sendRequest(teeRequest);

      // Return to DApp
      res.json(response);
    } catch (error) {
      logger.error('Request failed', { error });
      res.status(500).json({ error: error.message });
    }
  };
}
```

#### 5. Authentication Module (`src/auth/index.ts`)

```typescript
import { ethers } from 'ethers';

export class AuthModule {
  async verifyRequestSignature(
    request: DAppRequest
  ): Promise<boolean> {
    // 1. Reconstruct message
    const message = this.constructMessage(request);

    // 2. Hash message
    const messageHash = ethers.utils.hashMessage(message);

    // 3. Recover signer
    const signer = ethers.utils.recoverAddress(
      messageHash,
      request.signature
    );

    // 4. Verify signer matches expected public key
    return signer.toLowerCase() === request.publicKey.toLowerCase();
  }

  async checkRateLimit(tappId: string): Promise<boolean> {
    // Check rate limits for TAPP tier
  }
}
```

---

## Communication Protocols

### Vsocket Wire Protocol

**Format**: `[4-byte length (big-endian)][JSON payload]`

**Implementation**:

```typescript
// Writing
async function writeMessage(
  socket: net.Socket,
  message: TeeRequest
): Promise<void> {
  const json = JSON.stringify(message);
  const jsonBuffer = Buffer.from(json, 'utf-8');

  // Write length (4 bytes, big-endian)
  const lengthBuffer = Buffer.allocUnsafe(4);
  lengthBuffer.writeUInt32BE(jsonBuffer.length, 0);

  // Write to socket
  socket.write(lengthBuffer);
  socket.write(jsonBuffer);
}

// Reading
async function readMessage(
  socket: net.Socket
): Promise<TeeResponse> {
  // Read 4-byte length
  const lengthBuffer = await readExactly(socket, 4);
  const length = lengthBuffer.readUInt32BE(0);

  // Read N bytes
  const dataBuffer = await readExactly(socket, length);

  // Parse JSON
  return JSON.parse(dataBuffer.toString('utf-8'));
}

// Helper: Read exactly N bytes
async function readExactly(
  socket: net.Socket,
  bytes: number
): Promise<Buffer> {
  const buffer = Buffer.allocUnsafe(bytes);
  let offset = 0;

  while (offset < bytes) {
    const chunk = socket.read(bytes - offset);
    if (chunk === null) {
      await new Promise(resolve => socket.once('readable', resolve));
      continue;
    }
    chunk.copy(buffer, offset);
    offset += chunk.length;
  }

  return buffer;
}
```

---

## Data Flow

### Request Flow: DApp → Enclave → DApp

```typescript
// 1. DApp sends HTTPS request
POST /api/v1/request
{
  "method": "get_price",
  "params": { "symbol": "BTCUSDT" }
}

// 2. Host receives and validates
const dappRequest = req.body;
logger.info('Received request', { method: dappRequest.method });

// 3. Convert to TeeRequest
const teeRequest: TeeRequest = {
  id: uuidv4(),
  method: dappRequest.method,
  params: dappRequest.params,
  timestamp: Date.now(),
};

// 4. Send to enclave via vsocket
const teeResponse = await vsockClient.sendRequest(teeRequest);

// 5. Return to DApp
res.json(teeResponse);
```

### Attestation Flow

```typescript
// 1. Trigger attestation
POST /api/v1/attest

// 2. Request attestation from enclave
const attestationRequest: TeeRequest = {
  id: uuidv4(),
  method: 'get_attestation',
  params: {},
  timestamp: Date.now(),
};

const response = await vsockClient.sendRequest(attestationRequest);

// 3. Extract attestation data
const attestationDoc = Buffer.from(response.data.attestation, 'base64');
const certificateChain = response.data.certificates.map(c =>
  Buffer.from(c, 'base64')
);

// 4. Assemble bundle
const bundle: AttestationBundle = {
  attestationDoc,
  certificateChain,
  enclavePublicKey: response.data.publicKey,
  tappId: config.tappId,
};

// 5. Submit to L3
const submission = await l3Client.submitAttestation(bundle);

// 6. Return confirmation
res.json(submission);
```

---

## TypeScript Implementation Details

### Type Definitions

```typescript
// src/types/index.ts

// Protocol types (from orbs-tee-protocol package)
export interface TeeRequest {
  id: string;
  method: string;
  params: any;
  timestamp: number;
}

export interface TeeResponse {
  id: string;
  success: boolean;
  data?: any;
  signature?: string;
  error?: string;
}

// Host-specific types
export interface DAppRequest {
  method: string;
  params: any;
  tappId: string;
  signature?: string;
  timestamp: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  enclaveConnected: boolean;
  l3Reachable: boolean;
  uptimeSeconds: number;
}

export interface StatusResponse extends HealthStatus {
  hostVersion: string;
  enclavePublicKey?: string;
  l3GuardiansReachable: number;
  requestsProcessed: number;
}
```

### Error Handling

```typescript
// src/utils/errors.ts

export class HostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HostError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class VsocketError extends HostError {
  constructor(message: string) {
    super(message);
    this.name = 'VsocketError';
  }
}

export class L3Error extends HostError {
  constructor(message: string) {
    super(message);
    this.name = 'L3Error';
  }
}

export class AuthError extends HostError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Express error middleware
export function errorMiddleware() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Request error', { error: err.message, stack: err.stack });

    if (err instanceof VsocketError) {
      res.status(503).json({ error: 'Enclave unavailable' });
    } else if (err instanceof L3Error) {
      res.status(503).json({ error: 'L3 network unavailable' });
    } else if (err instanceof AuthError) {
      res.status(401).json({ error: 'Authentication failed' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
```

### Retry Logic

```typescript
// src/utils/retry.ts

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error;
  let delay = options.delayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < options.maxAttempts) {
        options.onRetry?.(attempt, error);
        await sleep(delay);
        delay *= options.backoffMultiplier;
      }
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Deployment Architecture

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:18-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

### Docker Compose (Local Testing)

```yaml
version: '3.8'

services:
  host:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./config.dev.json:/app/config.json
    environment:
      - LOG_LEVEL=debug
    networks:
      - tee-network
    depends_on:
      - mock-enclave

  mock-enclave:
    build:
      context: .
      dockerfile: Dockerfile.mock-enclave
    networks:
      - tee-network

networks:
  tee-network:
```

### AWS Nitro Deployment

```
┌────────────────────────────────────────────────────────────┐
│              EC2 Instance (Nitro-Enabled)                  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │          Parent Instance (Host OS)                   │ │
│  │                                                      │ │
│  │  ┌────────────────────────────────────────────────┐ │ │
│  │  │   Docker: orbs-tee-host (TypeScript/Node.js)   │ │ │
│  │  │   - Port 8080 exposed                          │ │ │
│  │  │   - vsocket client                             │ │ │
│  │  └────────────────────────────────────────────────┘ │ │
│  │                                                      │ │
│  └──────────────┬───────────────────────────────────────┘ │
│                 │                                          │
│                 │ vsocket (CID=3, Port=3000)               │
│                 ▼                                          │
│  ┌──────────────────────────────────────────────────────┐ │
│  │        Nitro Enclave (Rust - Isolated)               │ │
│  │  - orbs-tee-enclave-nitro                            │ │
│  │  - Protected memory                                  │ │
│  │  - vsocket server                                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Future Enhancements

### Phase 2 Features
- **WebSocket Support** - Real-time updates with `ws` or `socket.io`
- **Request Batching** - Optimize enclave calls
- **Response Caching** - Cache deterministic responses with `node-cache`
- **Multiple Enclaves** - Load balance across instances

### Advanced Monitoring
- **Distributed Tracing** - OpenTelemetry integration
- **Metrics** - Prometheus client (`prom-client`)
- **APM** - New Relic, Datadog integration

---

## References

- **ORBS V5 L3 TEE Architecture** - Main architecture document
- **orbs-tee-enclave-nitro** - Enclave SDK repository
- **orbs-tee-protocol** - npm package for protocol types
- **AWS Nitro Enclaves** - AWS documentation
- **vsocket** - Linux vsocket documentation
