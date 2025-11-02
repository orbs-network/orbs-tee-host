# ORBS TEE Host - Development TODO

## Project Status: Initial Development (TypeScript/Node.js)

This document tracks the development of the ORBS TEE Host application - the bridge between DApps and TEE enclaves.

**Tech Stack**: TypeScript, Node.js, Express/Fastify, Jest

---

## Phase 1: Foundation (Current)

### Documentation ✅
- [x] Create TODO.md
- [x] Create README.md
- [x] Create ARCHITECTURE.md
- [x] Create CLAUDE.md
- [x] Create DEVELOPMENT.md

### Project Setup
- [ ] Initialize package.json with dependencies
- [ ] Set up TypeScript configuration (tsconfig.json)
- [ ] Set up ESLint and Prettier
- [ ] Set up Jest for testing
- [ ] Create .gitignore
- [ ] Create example config files
- [ ] Set up build scripts

### Core Module Structure
- [ ] `src/index.ts` - Application entry point
- [ ] `src/config/index.ts` - Configuration management
- [ ] `src/vsock/client.ts` - Vsocket client
- [ ] `src/l3/client.ts` - ORBS L3 network client
- [ ] `src/auth/index.ts` - DApp authentication
- [ ] `src/api/server.ts` - HTTP API server
- [ ] `src/types/index.ts` - TypeScript type definitions
- [ ] `src/utils/logger.ts` - Logging utilities
- [ ] `src/utils/errors.ts` - Error classes

---

## Phase 2: Vsocket Communication

### Vsocket Client Implementation
- [ ] Install vsock npm package (Linux) or create Unix socket fallback (Mac)
- [ ] Implement length-prefixed wire protocol (4-byte length + JSON)
- [ ] Implement request serialization (TeeRequest from orbs-tee-protocol)
- [ ] Implement response deserialization (TeeResponse)
- [ ] Add connection retry logic with exponential backoff
- [ ] Add connection health checks
- [ ] Add timeout handling
- [ ] Add graceful connection shutdown

### Unix Socket Fallback for Mac
- [ ] Create Unix socket client for Mac development
- [ ] Implement same interface as vsocket client
- [ ] Auto-detect platform and use appropriate implementation

### Testing
- [ ] Unit tests for wire protocol encoding/decoding
- [ ] Mock vsocket tests for request/response flow
- [ ] Create mock enclave server for testing
- [ ] Integration test with mock enclave

---

## Phase 3: HTTP API Server

### API Implementation
- [ ] Choose framework (Express vs Fastify)
- [ ] Design REST API endpoints:
  - POST /api/v1/request - Forward request to enclave
  - POST /api/v1/attest - Trigger attestation submission
  - GET /api/v1/health - Health check
  - GET /api/v1/status - Host and enclave status
- [ ] Implement Express/Fastify server setup
- [ ] Implement request routing
- [ ] Implement middleware stack:
  - Logging middleware
  - CORS middleware
  - Error handling middleware
  - Request validation middleware
- [ ] Add TLS support
- [ ] Add request/response logging

### Testing
- [ ] Unit tests for route handlers
- [ ] Integration tests for API endpoints with supertest
- [ ] Load testing for concurrent requests

---

## Phase 4: Configuration Management

### Configuration Implementation
- [ ] Define configuration schema (TypeScript interfaces)
  - Vsocket settings (CID, port, timeout)
  - L3 network endpoints
  - API server settings (port, TLS)
  - Authentication settings
  - Logging settings
- [ ] Implement config file loading (JSON)
- [ ] Implement environment variable overrides (dotenv)
- [ ] Implement validation (joi or zod)
- [ ] Create example configs for different environments:
  - config.example.json
  - config.dev.json
  - config.prod.json

### Testing
- [ ] Test config parsing
- [ ] Test environment overrides
- [ ] Test validation

---

## Phase 5: ORBS L3 Client

### L3 Client Implementation
- [ ] Design L3 client API (attestation submission)
- [ ] Implement HTTP client to L3 guardians (axios or node-fetch)
- [ ] Implement attestation bundle assembly
- [ ] Implement certificate chain collection
- [ ] Add retry logic for L3 submissions
- [ ] Add response parsing (consensus status)
- [ ] Add polling for registration completion

### Testing
- [ ] Mock L3 responses (nock or msw)
- [ ] Test attestation submission flow
- [ ] Test error handling
- [ ] Test retry logic

---

## Phase 6: DApp Authentication (Phase 2 Feature)

### Authentication Implementation
- [ ] Design authentication scheme (public key signatures)
- [ ] Install ethers.js or web3.js for signature verification
- [ ] Implement signature verification (secp256k1)
- [ ] Implement request validation
- [ ] Implement TAPP ID extraction and validation
- [ ] Add authentication middleware for API
- [ ] Add rate limiting per TAPP (express-rate-limit)

### Testing
- [ ] Test signature verification
- [ ] Test invalid signatures
- [ ] Test rate limiting
- [ ] Test middleware integration

---

## Phase 7: Logging & Monitoring

### Logging Implementation
- [ ] Choose logging library (Winston vs Pino)
- [ ] Implement structured logging
- [ ] Add log levels configuration
- [ ] Add request/response logging
- [ ] Add error logging with context
- [ ] Add correlation IDs for tracing

### Health Checks
- [ ] Implement liveness probe
- [ ] Implement readiness probe
- [ ] Add enclave connectivity check
- [ ] Add L3 connectivity check

### Metrics (Future)
- [ ] Add Prometheus metrics (prom-client)
  - Request count
  - Response time
  - Error rate
  - Enclave communication metrics

---

## Phase 8: Docker & Deployment

### Docker Setup
- [ ] Create Dockerfile
  - Multi-stage build
  - Node.js alpine base image
  - Security best practices
- [ ] Create .dockerignore
- [ ] Create docker-compose.yml for local testing
  - Host service
  - Mock enclave service (for Mac testing)
- [ ] Create build scripts
- [ ] Document Docker deployment

### Testing
- [ ] Test Docker build on Mac
- [ ] Test Docker build on Linux
- [ ] Test container startup
- [ ] Test container networking
- [ ] Test with docker-compose

---

## Phase 9: Cross-Platform Testing Strategy

### Mac Development (Current Platform)
- [ ] Use Unix sockets instead of vsock for local testing
- [ ] Create mock enclave server for Mac (TypeScript)
- [ ] Test all non-vsock components
- [ ] Document Mac testing setup

### Linux Testing
- [ ] Test with real vsocket on Linux
- [ ] Test Docker networking with vsock
- [ ] Test on AWS Nitro Enclave environment
- [ ] Document Linux testing setup

### CI/CD
- [ ] Set up GitHub Actions
  - Build on Linux
  - Build on Mac
  - Run tests
  - Run linting
  - Build Docker image
- [ ] Add npm audit for security vulnerabilities
- [ ] Add type checking in CI

---

## Phase 10: Documentation & Examples

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Deployment guide
- [ ] Configuration reference
- [ ] Troubleshooting guide
- [ ] Security best practices

### Examples
- [ ] Example DApp client (TypeScript)
- [ ] Example request/response flow
- [ ] Example Docker deployment
- [ ] Example Kubernetes deployment

---

## Phase 11: Integration Testing

### End-to-End Testing
- [ ] Test with real enclave (from orbs-tee-enclave-nitro)
- [ ] Test attestation flow with L3 network
- [ ] Test DApp request flow
- [ ] Test key rotation scenarios
- [ ] Test error scenarios
- [ ] Performance testing
- [ ] Load testing (artillery or k6)

---

## Phase 12: Production Readiness

### Security
- [ ] Security audit of code
- [ ] Dependency vulnerability scanning (npm audit)
- [ ] TLS configuration hardening
- [ ] Authentication mechanism review
- [ ] Rate limiting review

### Performance
- [ ] Optimize request handling
- [ ] Connection pooling
- [ ] Resource limits
- [ ] Memory profiling (clinic.js)

### Operations
- [ ] Graceful shutdown
- [ ] Signal handling (SIGTERM, SIGINT)
- [ ] Log rotation
- [ ] Backup and recovery procedures

---

## Future Enhancements

### Features
- [ ] WebSocket support for real-time updates (ws or socket.io)
- [ ] Request batching
- [ ] Response caching (node-cache or Redis)
- [ ] Multiple enclave instances support
- [ ] Load balancing across enclaves
- [ ] Automatic failover

### Advanced Monitoring
- [ ] Distributed tracing (OpenTelemetry)
- [ ] APM integration (New Relic, Datadog)
- [ ] Alerting system
- [ ] Dashboard (Grafana)

---

## Notes

### Dependencies on Other Repos
- `orbs-tee-enclave-nitro`: Enclave SDK (completed, Rust)
- `orbs-tee-protocol`: Protocol definitions (npm package)
- ORBS L3 network: For attestation verification (exists)
- Guardian network: For signature verification (exists)

### Testing Strategy
1. **Mac Development**: Use Unix sockets for rapid iteration
2. **Linux Testing**: Test with real vsocket via Docker
3. **AWS Nitro**: Final integration testing in production environment

### Key Design Decisions
- TypeScript for type safety and ORBS ecosystem compatibility
- Express or Fastify for HTTP server (modern, fast, well-supported)
- Jest for testing (standard in TypeScript ecosystem)
- Docker for cross-platform deployment
- Configuration via JSON files + environment variables
- Structured logging with Winston or Pino
- ESLint + Prettier for code quality

### NPM Packages to Consider

**Core:**
- `orbs-tee-protocol` - Protocol types
- `express` or `fastify` - HTTP server
- `dotenv` - Environment variables
- `joi` or `zod` - Configuration validation

**Vsocket:**
- `vsock` - Linux vsocket support (or build Unix socket alternative)

**Crypto:**
- `ethers` or `@ethereumjs/util` - Signature verification

**HTTP Client:**
- `axios` or `node-fetch` - L3 communication

**Logging:**
- `winston` or `pino` - Structured logging

**Testing:**
- `jest` - Test framework
- `supertest` - API testing
- `nock` or `msw` - HTTP mocking

**Dev Tools:**
- `typescript` - TypeScript compiler
- `ts-node` - Run TypeScript directly
- `nodemon` - Auto-restart on changes
- `eslint` + `@typescript-eslint` - Linting
- `prettier` - Code formatting

---

## Current Focus

**Phase 1: Foundation** - Creating documentation and initializing TypeScript project

Next steps:
1. Complete documentation
2. Initialize package.json
3. Set up TypeScript configuration
4. Create module structure
5. Begin vsocket client implementation

---

## Quick Reference: NPM Commands

```bash
# Development
npm install           # Install dependencies
npm run dev           # Run with watch mode
npm run build         # Build TypeScript
npm start             # Run built code

# Testing
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report

# Quality
npm run lint          # ESLint
npm run format        # Prettier
npm run type-check    # TypeScript check

# Docker
npm run docker:build  # Build image
npm run docker:up     # Start compose
```
