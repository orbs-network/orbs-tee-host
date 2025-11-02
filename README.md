# ORBS TEE Host

The **ORBS TEE Host** is the bridge component that connects DApps with Trusted Execution Environment (TEE) enclaves running on AWS Nitro (and other TEE platforms). It runs outside the enclave as an untrusted component, handling communication, attestation submission, and DApp API endpoints.

**Built with TypeScript/Node.js** for seamless integration with the ORBS ecosystem.

## Overview

This host application is part of the ORBS V5 L3 TEE Architecture, which provides:

- **Off-chain TEE attestation verification** - Reduces gas costs by 40-67%
- **Multi-vendor TEE support** - Intel SGX, AWS Nitro, and future vendors
- **Decentralized trust** - 22 independent guardians with M-of-N consensus
- **Cross-chain support** - Single L3 instance serves multiple blockchains

## Architecture

```
DApp (TypeScript/Web3)
    ↓ HTTPS
Host (TypeScript - THIS APPLICATION)
    ↓ vsocket
Enclave (Rust - orbs-tee-enclave-nitro)
    ↓ Attestation
ORBS L3 Guardian Network
    ↓ Verification Result
On-Chain Registrar Contract
```

### Host Responsibilities

The host acts as a bridge, providing these services:

1. **Enclave Communication** (vsocket)
   - Forward DApp requests to enclave
   - Receive signed responses from enclave
   - Handle connection management and retries

2. **HTTPS API for DApps**
   - Expose REST endpoints for DApp requests
   - Authenticate incoming DApp requests
   - Return signed responses to DApps

3. **Attestation Submission**
   - Collect attestation documents from enclave
   - Assemble certificate chains
   - Submit to ORBS L3 network for verification

4. **DApp Authentication** (Phase 2)
   - Verify DApp request signatures
   - Enforce rate limiting per TAPP tier
   - Validate TAPP staking status

### What Host Does NOT Do

❌ Verify enclave response signatures (Guardian's job)
❌ Verify attestation documents (Guardian's job)
❌ Handle private keys (Enclave-only)
❌ Reach consensus (Guardian network's job)

## Features

- ✅ **TypeScript** - Type-safe development
- ✅ **Cross-Platform Docker** - Runs anywhere Docker runs
- ✅ **Vsocket Support** - Native AWS Nitro communication
- ✅ **Unix Socket Fallback** - Local testing on Mac/Windows
- ✅ **REST API** - Express.js or Fastify
- ✅ **TLS Support** - Secure DApp communication
- ✅ **Structured Logging** - Winston or Pino
- ✅ **Configuration Management** - Environment variables + config files
- ✅ **Health Checks** - Kubernetes/Docker ready
- ✅ **Graceful Shutdown** - Safe connection handling

## Quick Start

### Prerequisites

- **Node.js 18+** (LTS)
- **npm** or **yarn**
- **Docker** (for containerized deployment)
- **Linux** (for vsocket support in production)
- **macOS** (supported for development with Unix sockets)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/orbs-network/orbs-tee-host.git
cd orbs-tee-host

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Run locally (development mode)
npm run dev
```

### Docker Deployment

```bash
# Build Docker image
docker build -t orbs-tee-host .

# Run with Docker Compose
docker-compose up
```

### Configuration

Create `config.json`:

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

Override with environment variables:
```bash
export VSOCK_PORT=3000
export API_PORT=8080
export LOG_LEVEL=debug
npm run start
```

## API Endpoints

### POST /api/v1/request
Forward a request to the enclave and return signed response.

**Request:**
```json
{
  "method": "get_price",
  "params": {
    "symbol": "BTCUSDT"
  },
  "tappId": "0x1234...",
  "signature": "0xabcd...",
  "timestamp": 1672531200
}
```

**Response:**
```json
{
  "id": "req-uuid-1234",
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "price": "45000.50"
  },
  "signature": "0x5678...",
  "publicKey": "0x04a1b2..."
}
```

### POST /api/v1/attest
Trigger attestation document submission to L3 network.

**Response:**
```json
{
  "status": "submitted",
  "attestationId": "att-uuid-5678",
  "submissionTime": "2024-01-15T10:30:00Z"
}
```

### GET /api/v1/health
Health check endpoint for load balancers.

**Response:**
```json
{
  "status": "healthy",
  "enclaveConnected": true,
  "l3Reachable": true,
  "uptimeSeconds": 3600
}
```

### GET /api/v1/status
Detailed status information.

**Response:**
```json
{
  "hostVersion": "0.1.0",
  "enclaveConnected": true,
  "enclavePublicKey": "0x04a1b2...",
  "l3GuardiansReachable": 22,
  "requestsProcessed": 1250,
  "uptimeSeconds": 3600
}
```

## NPM Scripts

```bash
# Development
npm run dev          # Run with ts-node and watch mode
npm run build        # Build TypeScript to JavaScript
npm run start        # Run built JavaScript

# Testing
npm test             # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format with Prettier
npm run type-check   # TypeScript type checking

# Docker
npm run docker:build # Build Docker image
npm run docker:run   # Run Docker container
```

## Testing Strategy

### Mac Development (Unix Sockets)
```bash
# Run with Unix socket fallback
npm run dev

# Run mock enclave server
npm run mock:enclave
```

### Linux Testing (Vsocket)
```bash
# Build for Linux
npm run build

# Run on Linux with vsock
npm start
```

### Docker Testing
```bash
# Test container build
docker build -t orbs-tee-host:test .

# Test with compose
docker-compose -f docker-compose.test.yml up
```

## Deployment

### AWS Nitro Enclaves

1. **Launch EC2 instance** with Nitro Enclaves enabled
2. **Build and run enclave** (from orbs-tee-enclave-nitro repo)
3. **Deploy host container**:
   ```bash
   docker run -d \
     --name orbs-tee-host \
     -p 8080:8080 \
     -v /path/to/config.json:/app/config.json \
     orbs-tee-host:latest
   ```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orbs-tee-host
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: host
        image: orbs-tee-host:latest
        ports:
        - containerPort: 8080
        volumeMounts:
        - name: config
          mountPath: /app/config.json
          subPath: config.json
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 8080
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 8080
```

## Development

### Project Structure

```
orbs-tee-host/
├── src/
│   ├── index.ts              # Application entry point
│   ├── config/
│   │   └── index.ts          # Configuration management
│   ├── vsock/
│   │   └── client.ts         # Vsocket client
│   ├── l3/
│   │   └── client.ts         # L3 network client
│   ├── auth/
│   │   └── index.ts          # DApp authentication
│   ├── api/
│   │   ├── server.ts         # HTTP server
│   │   ├── routes/           # API routes
│   │   └── middleware/       # Express middleware
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   └── utils/
│       ├── logger.ts         # Logging utilities
│       └── errors.ts         # Error classes
├── test/                     # Jest tests
├── examples/                 # Example clients
├── config.example.json       # Example configuration
├── Dockerfile                # Container build
├── docker-compose.yml        # Local testing
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── jest.config.js            # Jest config
├── .eslintrc.js              # ESLint config
├── .prettierrc               # Prettier config
├── README.md                 # This file
├── TODO.md                   # Development roadmap
├── ARCHITECTURE.md           # Design documentation
└── CLAUDE.md                 # AI assistant guidance
```

## Security Considerations

### Host Security Model

The host is **untrusted** - it runs outside the TEE and cannot:
- Access enclave private keys
- Modify enclave responses (signatures would break)
- Forge attestation documents

However, the host CAN:
- Delay or drop requests (availability attack)
- Log request/response data (privacy concern)
- Connect to wrong enclave (mitigated by attestation verification)

### Mitigations

✅ **Response tampering** - Enclave signs all responses
✅ **Attestation forgery** - Guardian network verifies attestations
✅ **Man-in-the-middle** - TLS for DApp connections
✅ **DoS attacks** - Rate limiting per TAPP
✅ **Unauthorized access** - DApp authentication

## Related Repositories

- **[orbs-tee-enclave-nitro](https://github.com/orbs-network/orbs-tee-enclave-nitro)** - Enclave SDK (trusted component)
- **[orbs-tee-protocol](https://www.npmjs.com/package/orbs-tee-protocol)** - Protocol definitions (npm package)
- **orbs-tee-guardian** - Guardian attestation verifier (TBD)

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `npm run lint` and `npm run format`
5. Submit a pull request

## License

MIT

## Support

- **Documentation**: See `/docs` directory
- **Issues**: GitHub Issues
- **Architecture**: See [ORBS V5 L3 TEE Architecture doc](../docs/architecture.md)

---

**Status**: 🚧 **In Development** - Phase 1 (Foundation)

See [TODO.md](TODO.md) for development roadmap.
