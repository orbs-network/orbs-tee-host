# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **ORBS TEE Host** - the untrusted bridge component that connects DApps with TEE enclaves running on AWS Nitro (and other TEE platforms). It's part of the ORBS V5 L3 TEE Architecture.

**Tech Stack**: TypeScript, Node.js, Express/Fastify

**Key Insight**: The host is **untrusted** and runs outside the TEE. It cannot access private keys or forge signatures. Its job is to forward requests, submit attestations, and expose APIs - not to verify enclave responses (that's the guardian network's job).

## Build and Test Commands

### Development Commands

```bash
# Install dependencies
npm install

# Development mode (with watch)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run built code
npm start

# Type checking
npm run type-check
```

### Testing Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- vsock.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="wire protocol"
```

### Code Quality Commands

```bash
# Run ESLint
npm run lint

# Fix ESLint issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

### Docker Commands

```bash
# Build Docker image
npm run docker:build
# OR
docker build -t orbs-tee-host .

# Run with docker-compose
docker-compose up

# Run in background
docker-compose up -d

# View logs
docker logs -f orbs-tee-host

# Stop containers
docker-compose down
```

## Project Structure

```
orbs-tee-host/
├── src/
│   ├── index.ts              # Application entry point
│   ├── config/
│   │   └── index.ts          # Configuration management
│   ├── vsock/
│   │   ├── client.ts         # Vsocket client (Linux)
│   │   └── unix-client.ts    # Unix socket client (Mac)
│   ├── l3/
│   │   └── client.ts         # ORBS L3 network client
│   ├── auth/
│   │   └── index.ts          # DApp authentication
│   ├── api/
│   │   ├── server.ts         # HTTP server
│   │   ├── routes/
│   │   │   ├── request.ts    # POST /api/v1/request
│   │   │   ├── attest.ts     # POST /api/v1/attest
│   │   │   ├── health.ts     # GET /api/v1/health
│   │   │   └── status.ts     # GET /api/v1/status
│   │   └── middleware/
│   │       ├── logging.ts    # Request logging
│   │       ├── auth.ts       # Authentication
│   │       └── error.ts      # Error handling
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   └── utils/
│       ├── logger.ts         # Winston/Pino logger
│       ├── errors.ts         # Custom error classes
│       └── retry.ts          # Retry utilities
├── test/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── e2e/                  # End-to-end tests
├── examples/
│   ├── mock-enclave.ts       # Mock enclave for testing
│   └── client-example.ts     # Example DApp client
├── config.example.json       # Example configuration
├── Dockerfile                # Container build
├── docker-compose.yml        # Local testing
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── jest.config.js            # Jest configuration
├── .eslintrc.js              # ESLint configuration
├── .prettierrc               # Prettier configuration
├── .gitignore                # Git ignore rules
├── README.md                 # User documentation
├── TODO.md                   # Development roadmap
├── ARCHITECTURE.md           # Design documentation
└── CLAUDE.md                 # This file
```

## Architecture

### Core Responsibility

The host acts as a **stateless bridge** between DApps and TEE enclaves:

```
DApp → Host → Enclave (via vsocket)
     ← Host ← (signed response)
```

The host also submits attestations to the L3 network:

```
Host → Enclave (request attestation)
    ← (attestation document)
Host → L3 Guardians (submit for verification)
L3 Network → Registrar Contract (store verified keys)
```

### What Host Does

✅ Forward DApp requests to enclave via vsocket
✅ Return signed responses to DApps
✅ Submit attestation documents to L3 network
✅ Authenticate DApp requests (verify signatures)
✅ Expose HTTPS API endpoints
✅ Handle connection management and retries

### What Host Does NOT Do

❌ Verify enclave response signatures (Guardian network does this)
❌ Verify attestation documents (Guardian network does this)
❌ Access enclave private keys (Keys never leave TEE)
❌ Forge or modify responses (Would break signatures)

### Key Components

1. **Vsocket Client** (`src/vsock/client.ts`)
   - Connects to enclave via vsocket (Linux) or Unix socket (Mac)
   - Implements length-prefixed wire protocol: `[4-byte length][JSON]`
   - Handles retries with exponential backoff
   - Request: `TeeRequest` → Response: `TeeResponse`

2. **L3 Client** (`src/l3/client.ts`)
   - Submits attestation bundles to guardian network
   - Polls for consensus status
   - Handles multiple guardian endpoints
   - Retry logic with fallback guardians

3. **HTTP API Server** (`src/api/server.ts`)
   - Express or Fastify-based REST API
   - Middleware: logging, CORS, authentication
   - Routes:
     - `POST /api/v1/request` - Forward request to enclave
     - `POST /api/v1/attest` - Trigger attestation
     - `GET /api/v1/health` - Health check
     - `GET /api/v1/status` - Detailed status

4. **Authentication** (`src/auth/index.ts`)
   - Verify DApp request signatures (Phase 2)
   - Rate limiting per TAPP tier (Phase 2)
   - TAPP ID validation

5. **Configuration** (`src/config/index.ts`)
   - Load from JSON files
   - Override with environment variables
   - Validation with Joi or Zod

## Communication Protocols

### Vsocket Wire Protocol

**Format**: `[4-byte length (big-endian u32)][N bytes JSON]`

**Writing**:
```typescript
// 1. Serialize to JSON
const json = JSON.stringify(request);
const jsonBuffer = Buffer.from(json, 'utf-8');

// 2. Create length buffer (big-endian u32)
const lengthBuffer = Buffer.allocUnsafe(4);
lengthBuffer.writeUInt32BE(jsonBuffer.length, 0);

// 3. Write length then JSON
await stream.write(lengthBuffer);
await stream.write(jsonBuffer);
```

**Reading**:
```typescript
// 1. Read 4 bytes for length
const lengthBuffer = await readExactly(stream, 4);
const length = lengthBuffer.readUInt32BE(0);

// 2. Read N bytes
const dataBuffer = await readExactly(stream, length);

// 3. Parse JSON
const response: TeeResponse = JSON.parse(dataBuffer.toString('utf-8'));
```

### Protocol Types

From `orbs-tee-protocol` npm package:

```typescript
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
  signature?: string;  // Hex-encoded ECDSA
  error?: string;
}
```

## Testing Strategy

### Cross-Platform Testing

**Mac Development** (current platform):
- Use Unix sockets instead of vsocket
- Create mock enclave server
- Test all non-vsocket components

**Linux Testing**:
- Test with real vsocket
- Test Docker networking
- Test on AWS Nitro Enclave environment

### Test Organization

```
test/
├── unit/
│   ├── vsock.test.ts         # Wire protocol tests
│   ├── config.test.ts        # Configuration tests
│   └── auth.test.ts          # Authentication tests
├── integration/
│   ├── api.test.ts           # API endpoint tests
│   └── e2e.test.ts           # Full flow tests
└── helpers/
    └── mocks.ts              # Mock utilities
```

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- vsock.test.ts

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# With output
npm test -- --verbose
```

## Configuration

### Example Config (config.json)

```json
{
  "vsock": {
    "cid": 3,
    "port": 3000,
    "timeoutMs": 30000,
    "retryAttempts": 5,
    "retryDelayMs": 100
  },
  "l3": {
    "endpoints": [
      "https://guardian1.orbs.network",
      "https://guardian2.orbs.network"
    ],
    "timeoutMs": 30000,
    "retryAttempts": 3
  },
  "api": {
    "host": "0.0.0.0",
    "port": 8080,
    "tlsEnabled": false
  },
  "auth": {
    "enabled": false,
    "rateLimitingEnabled": false
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

### Environment Variable Overrides

```bash
VSOCK_CID=3
VSOCK_PORT=3000
API_PORT=8080
LOG_LEVEL=debug
npm start
```

## Dependencies

### Core Dependencies

- **orbs-tee-protocol** - Protocol types (TeeRequest/TeeResponse)
- **express** or **fastify** - HTTP server framework
- **dotenv** - Environment variable loading
- **joi** or **zod** - Configuration validation

### Communication

- **axios** - HTTP client for L3 communication
- Platform-specific socket implementation (vsock on Linux, net.Socket on Mac)

### Crypto

- **ethers** - Signature verification for DApp auth (Phase 2)

### Logging

- **winston** or **pino** - Structured logging

### Development Dependencies

- **typescript** - TypeScript compiler
- **ts-node** - Run TypeScript directly
- **nodemon** - Auto-restart on changes
- **@types/node** - Node.js type definitions
- **@types/express** - Express type definitions

### Testing Dependencies

- **jest** - Test framework
- **ts-jest** - Jest TypeScript support
- **@types/jest** - Jest type definitions
- **supertest** - HTTP API testing
- **nock** - HTTP request mocking

### Code Quality

- **eslint** - Linting
- **@typescript-eslint/parser** - TypeScript ESLint parser
- **@typescript-eslint/eslint-plugin** - TypeScript ESLint rules
- **prettier** - Code formatting
- **eslint-config-prettier** - Disable ESLint formatting rules

## Development Notes

### Adding New Features

1. Update `TODO.md` to track the feature
2. Add types to `src/types/index.ts`
3. Write tests first (TDD approach)
4. Implement feature
5. Update documentation
6. Run full test suite
7. Update `ARCHITECTURE.md` if needed

### Error Handling

Always use custom error classes from `src/utils/errors.ts`:

```typescript
export class HostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HostError';
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
```

### Logging Best Practices

Use structured logging:

```typescript
import logger from './utils/logger';

// Good: Structured fields
logger.info('Connected to enclave', {
  cid: vsockConfig.cid,
  port: vsockConfig.port,
});

// Bad: String formatting
logger.info(`Connected to enclave at ${cid}:${port}`);
```

### Async Patterns

Always use async/await:

```typescript
// Good: Async function
async function sendRequest(req: TeeRequest): Promise<TeeResponse> {
  const conn = await connect();
  const response = await conn.send(req);
  return response;
}

// Bad: Promise chains
function sendRequest(req: TeeRequest): Promise<TeeResponse> {
  return connect()
    .then(conn => conn.send(req))
    .then(response => response);
}
```

## Common Tasks

### Adding a New API Endpoint

1. Create route handler in `src/api/routes/`:
```typescript
// src/api/routes/my-endpoint.ts
import { Request, Response } from 'express';

export async function handleMyEndpoint(req: Request, res: Response) {
  try {
    // Implementation
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

2. Register route in `src/api/server.ts`:
```typescript
import { handleMyEndpoint } from './routes/my-endpoint';

app.post('/api/v1/my-endpoint', handleMyEndpoint);
```

3. Add tests in `test/integration/api.test.ts`

### Adding Configuration Options

1. Update interface in `src/config/index.ts`:
```typescript
export interface Config {
  myOption: string;
}
```

2. Update validation schema
3. Update example config files
4. Document in README.md

### Implementing Retry Logic

Use the retry utility:

```typescript
import { retryWithBackoff } from './utils/retry';

const result = await retryWithBackoff(
  async () => {
    return await l3Client.submit(attestation);
  },
  {
    maxAttempts: 5,
    delayMs: 100,
    backoffMultiplier: 2,
  }
);
```

## Security Considerations

### Trust Model

The host is **untrusted**:
- Runs outside TEE enclave
- Can see all requests/responses (log carefully!)
- Cannot access enclave private keys
- Cannot forge signatures

### Security Best Practices

1. **Never log sensitive data** - Be careful with request/response logging
2. **Validate all inputs** - Check DApp requests before forwarding
3. **Use HTTPS in production** - Encrypt DApp connections
4. **Rate limit requests** - Prevent DoS attacks
5. **Authenticate DApps** - Verify request signatures (Phase 2)

### Threat Model

**What host CAN be compromised to do**:
- Delay or drop requests (availability attack)
- Log sensitive data (privacy concern)
- Connect to wrong enclave (mitigated by attestation)

**What host CANNOT do even if compromised**:
- Access enclave private keys
- Forge response signatures
- Modify enclave code
- Bypass attestation verification

## Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm start
```

### Debug Specific Module

```bash
DEBUG=orbs:vsock npm start
```

### Common Issues

**Cannot connect to enclave**:
- Check enclave is running
- Verify vsocket CID and port in config
- Check vsock kernel module loaded (Linux)

**Tests failing on Mac**:
- Ensure using Unix socket implementation
- Check mock enclave is running

**Docker build fails**:
- Check Dockerfile for correct Node.js version
- Verify all files copied correctly
- Check permissions

**TypeScript errors**:
```bash
# Run type checker
npm run type-check

# Clean build
rm -rf dist/ && npm run build
```

## Related Repositories

- **orbs-tee-enclave-nitro** (`/Users/ami/orbs/orbs-tee-enclave-nitro`) - Enclave SDK (Rust)
- **orbs-tee-protocol** (npm package) - Protocol definitions
- **orbs-tee-guardian** (TBD) - Guardian attestation verifier

## Current Status

**Phase**: Phase 1 - Foundation (Documentation Complete)

**Next Steps**:
1. Initialize package.json with dependencies
2. Set up TypeScript configuration
3. Create src/ module structure
4. Implement vsocket client
5. Implement HTTP API server

See [TODO.md](TODO.md) for full roadmap.

## Key Design Decisions

1. **TypeScript** - Type safety and ORBS ecosystem compatibility
2. **Express or Fastify** - Modern, fast HTTP framework
3. **Jest** - Standard TypeScript testing framework
4. **Docker** - Cross-platform deployment
5. **Stateless** - No persistent state, easy to scale
6. **Configuration** - JSON files + environment variables
7. **Structured logging** - Winston or Pino for observability

## References

- **ORBS V5 L3 TEE Architecture** - See handoff document
- **Enclave SDK README** - `/Users/ami/orbs/orbs-tee-enclave-nitro/README.md`
- **Vsocket Protocol** - See `ARCHITECTURE.md`
- **AWS Nitro Enclaves** - https://aws.amazon.com/ec2/nitro/nitro-enclaves/
- **orbs-tee-protocol** - https://www.npmjs.com/package/orbs-tee-protocol
