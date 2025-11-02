# Development Guide (TypeScript/Node.js)

This document provides a step-by-step guide for developing the ORBS TEE Host application with TypeScript.

## Quick Start

### Prerequisites

```bash
# Check Node.js version (need 18+)
node --version

# Check npm
npm --version

# Install dependencies (after initialization)
npm install
```

### Development Workflow

```bash
# Development mode (watch + auto-reload)
npm run dev

# Build TypeScript
npm run build

# Run built code
npm start

# Run tests
npm test

# Lint and format
npm run lint
npm run format
```

## Development Strategy

### Three-Tier Testing Strategy

1. **Mac Development** (Current Platform)
   - Use Unix sockets instead of vsocket
   - Create mock enclave server (TypeScript)
   - Rapid iteration and testing
   - No AWS Nitro required

2. **Docker on Linux**
   - Test with real vsocket in Docker container
   - Simulate production environment
   - Test networking and deployment

3. **AWS Nitro Production**
   - Final integration with real enclave
   - Full attestation flow
   - Production deployment

## Phase-by-Phase Implementation

### Phase 1: Foundation ✅

**Tasks**:
- [x] Create documentation
- [ ] Initialize package.json
- [ ] Set up TypeScript (tsconfig.json)
- [ ] Set up ESLint and Prettier
- [ ] Set up Jest
- [ ] Create .gitignore

### Phase 2: Vsocket Client

**Goal**: Communicate with enclave using Unix sockets (Mac) or vsocket (Linux)

**Implementation**:

1. **Create socket interface**:
```typescript
// src/vsock/client.ts
export interface SocketClient {
  connect(): Promise<void>;
  sendRequest(req: TeeRequest): Promise<TeeResponse>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}
```

2. **Implement Unix socket client** (Mac):
```typescript
// src/vsock/unix-client.ts
import * as net from 'net';

export class UnixSocketClient implements SocketClient {
  private socket?: net.Socket;

  async connect(): Promise<void> {
    this.socket = net.connect('/tmp/enclave.sock');
    await new Promise(resolve => this.socket!.once('connect', resolve));
  }

  async sendRequest(req: TeeRequest): Promise<TeeResponse> {
    await this.writeMessage(req);
    return await this.readMessage();
  }
}
```

3. **Implement vsocket client** (Linux):
```typescript
// src/vsock/client.ts
// Similar to Unix socket but uses vsocket
```

4. **Create mock enclave**:
```typescript
// examples/mock-enclave.ts
// Listens on Unix socket, responds to requests
```

**Testing**:
```bash
# Terminal 1: Run mock enclave
npm run mock:enclave

# Terminal 2: Run host
npm run dev

# Terminal 3: Test request
curl -X POST http://localhost:8080/api/v1/request \
  -H "Content-Type: application/json" \
  -d '{"method":"echo","params":{"msg":"hello"}}'
```

### Phase 3: HTTP API Server

**Goal**: Expose REST API for DApps

**Implementation**:

1. **Choose framework**: Express (more common) or Fastify (faster)

2. **Create server**:
```typescript
// src/api/server.ts
import express from 'express';

export function createServer(
  vsockClient: SocketClient,
  config: ApiConfig
): express.Application {
  const app = express();

  app.use(express.json());
  app.use(loggingMiddleware());
  app.use(cors());

  app.post('/api/v1/request', handleRequest(vsockClient));
  app.post('/api/v1/attest', handleAttest(vsockClient));
  app.get('/api/v1/health', handleHealth(vsockClient));
  app.get('/api/v1/status', handleStatus());

  return app;
}
```

3. **Test with supertest**:
```typescript
// test/integration/api.test.ts
import request from 'supertest';

describe('API', () => {
  it('should handle requests', async () => {
    const response = await request(app)
      .post('/api/v1/request')
      .send({ method: 'echo', params: { msg: 'test' } });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### Phase 4: Configuration

**Goal**: Flexible configuration via JSON files + environment variables

**Implementation**:

```typescript
// src/config/index.ts
import * as fs from 'fs';
import * as Joi from 'joi';

const configSchema = Joi.object({
  vsock: Joi.object({
    cid: Joi.number().required(),
    port: Joi.number().required(),
    timeoutMs: Joi.number().default(30000),
  }),
  api: Joi.object({
    host: Joi.string().default('0.0.0.0'),
    port: Joi.number().default(8080),
  }),
});

export function loadConfig(): Config {
  // 1. Load from config.json
  const configFile = fs.readFileSync('config.json', 'utf-8');
  const baseConfig = JSON.parse(configFile);

  // 2. Override with environment variables
  const config = {
    ...baseConfig,
    vsock: {
      ...baseConfig.vsock,
      port: process.env.VSOCK_PORT ? parseInt(process.env.VSOCK_PORT) : baseConfig.vsock.port,
    },
    api: {
      ...baseConfig.api,
      port: process.env.API_PORT ? parseInt(process.env.API_PORT) : baseConfig.api.port,
    },
  };

  // 3. Validate
  const { error, value } = configSchema.validate(config);
  if (error) {
    throw new Error(`Config validation failed: ${error.message}`);
  }

  return value;
}
```

### Phase 5: L3 Client

**Goal**: Submit attestations to guardian network

**Implementation**:

```typescript
// src/l3/client.ts
import axios from 'axios';

export class L3Client {
  constructor(private config: L3Config) {}

  async submitAttestation(
    bundle: AttestationBundle
  ): Promise<AttestationSubmission> {
    // Try each guardian endpoint with retry
    for (const endpoint of this.config.endpoints) {
      try {
        const response = await axios.post(
          `${endpoint}/attestation/submit`,
          {
            attestation_doc: bundle.attestationDoc.toString('base64'),
            certificate_chain: bundle.certificateChain.map(c => c.toString('base64')),
            enclave_public_key: bundle.enclavePublicKey,
            tapp_id: bundle.tappId,
          },
          { timeout: this.config.timeoutMs }
        );

        return response.data;
      } catch (error) {
        logger.warn(`Guardian ${endpoint} failed`, { error });
        continue;
      }
    }

    throw new L3Error('All guardians unreachable');
  }
}
```

## Testing

### Unit Tests

```typescript
// test/unit/vsock.test.ts
import { UnixSocketClient } from '../src/vsock/unix-client';

describe('UnixSocketClient', () => {
  it('should encode wire protocol correctly', async () => {
    const client = new UnixSocketClient(config);
    // Test wire protocol encoding/decoding
  });
});
```

### Integration Tests

```typescript
// test/integration/e2e.test.ts
import { createServer } from '../src/api/server';
import request from 'supertest';

describe('End-to-end', () => {
  it('should handle full request flow', async () => {
    // Start mock enclave
    // Create server
    // Send request
    // Verify response
  });
});
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Specific test
npm test -- vsock.test.ts
```

## Docker Development

### Local Development

```dockerfile
# Dockerfile.dev
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

CMD ["npm", "run", "dev"]
```

```bash
# Build and run
docker build -f Dockerfile.dev -t orbs-tee-host:dev .
docker run -p 8080:8080 orbs-tee-host:dev
```

### Production Build

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

## AWS Nitro Deployment

### Prerequisites

1. **EC2 Instance** with Nitro Enclaves enabled
2. **Enclave running** (from orbs-tee-enclave-nitro repo)
3. **vsocket available** (Linux only)

### Deployment Steps

```bash
# 1. Build Docker image
docker build -t orbs-tee-host:latest .

# 2. Run container
docker run -d \
  --name orbs-tee-host \
  -p 8080:8080 \
  -v /path/to/config.json:/app/config.json \
  orbs-tee-host:latest

# 3. Verify
curl http://localhost:8080/api/v1/health
```

## Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run dev
```

### Debug Specific Module

```bash
DEBUG=orbs:* npm run dev
```

### Common Issues

**TypeScript errors**:
```bash
# Check types
npm run type-check

# Clean build
rm -rf dist/ && npm run build
```

**Cannot connect to enclave**:
- Check Unix socket path (Mac)
- Check vsocket CID/port (Linux)
- Verify enclave is running

**Tests failing**:
- Check mock enclave is running
- Verify test configuration
- Check for port conflicts

## Code Quality

### ESLint

```bash
# Check for issues
npm run lint

# Fix automatically
npm run lint:fix
```

### Prettier

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

### Pre-commit Hooks

```bash
# Install husky
npm install -D husky

# Set up pre-commit
npx husky install
npx husky add .husky/pre-commit "npm run lint && npm test"
```

## Next Steps

1. **Complete Phase 1**: Initialize package.json and TypeScript config
2. **Implement Phase 2**: Build vsocket client with Unix socket for Mac
3. **Create mock enclave**: Test communication
4. **Progress through phases**: Follow roadmap in TODO.md

See [TODO.md](TODO.md) for detailed task breakdown.
