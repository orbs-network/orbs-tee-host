# ORBS TEE Host - Deployment Guide

This guide covers deploying the TEE Host on AWS Nitro Enclaves with the real enclave.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Understanding Vsock](#understanding-vsock)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Deployment Steps](#deployment-steps)
- [Testing the Setup](#testing-the-setup)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         EC2 Parent Instance             │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │     ORBS TEE Host (Node.js)      │  │
│  │                                  │  │
│  │  - Exposes HTTP API on :8080     │  │
│  │  - Connects to enclave via vsock │  │
│  │  - Submits to L3 guardians       │  │
│  └──────────────────────────────────┘  │
│              │                          │
│              │ vsock (CID 3:5000)       │
│              ▼                          │
│  ┌──────────────────────────────────┐  │
│  │    AWS Nitro Enclave             │  │
│  │                                  │  │
│  │  - Runs orbs-tee-enclave-nitro   │  │
│  │  - Handles crypto operations      │  │
│  │  - Generates attestations         │  │
│  │  - Listens on vsock CID 3:5000   │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Understanding Vsock

### What is Vsock?

**Vsock (Virtual Socket)** is a socket-based communication protocol for VM-to-host communication in virtualized environments. It's specifically designed for AWS Nitro Enclaves.

### Key Concepts

#### CID (Context Identifier)
Think of CID as an "IP address" for vsock communication:

- **CID 2**: Always refers to the **parent EC2 instance** (host)
- **CID 3**: Always refers to the **enclave** (first enclave)
- **CID 4+**: Additional enclaves if you run multiple

#### Port
Similar to TCP/UDP ports, vsock uses ports to identify services:

- The enclave listens on a specific port (e.g., 5000)
- The host connects to `CID:PORT` (e.g., `3:5000`)

#### Communication Pattern

```
Host (CID 2)                    Enclave (CID 3)
    │                                │
    │  Connect to CID 3, Port 5000   │
    │ ───────────────────────────>   │
    │                                │ Server listening on
    │                                │ 0.0.0.0:5000 (inside enclave)
    │                                │
    │  Send request (JSON)           │
    │ ───────────────────────────>   │
    │                                │
    │  Receive response (JSON)       │
    │ <───────────────────────────   │
```

### Vsock vs TCP

| Aspect | TCP Socket | Vsock |
|--------|-----------|-------|
| **Network** | Requires network interface | No network needed |
| **Security** | Can be sniffed/intercepted | Isolated, memory-only |
| **Addressing** | IP:Port | CID:Port |
| **Use Case** | Internet communication | VM-to-host only |

### Why Vsock for TEE?

1. **Security**: Traffic never leaves the physical machine
2. **Isolation**: Enclave can communicate without network access
3. **Performance**: Low-latency memory-based communication
4. **Simplicity**: No network configuration needed

## Prerequisites

### On AWS

1. **EC2 Instance** with Nitro Enclave support:
   - Instance types: `c5.xlarge`, `m5.xlarge`, `r5.xlarge`, etc.
   - Enable enclave support when launching
   - At least 4 vCPUs (2 for parent, 2 for enclave)
   - At least 8GB RAM (4GB for parent, 4GB for enclave)

2. **AWS CLI** and **Nitro CLI** installed:
   ```bash
   sudo amazon-linux-extras install aws-nitro-enclaves-cli
   sudo yum install aws-nitro-enclaves-cli-devel
   ```

3. **Node.js 18+** installed on the parent instance:
   ```bash
   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo yum install -y nodejs
   ```

### Repositories

1. **orbs-tee-enclave-nitro**: The Rust-based enclave code
2. **orbs-tee-host**: This repository (Node.js host)

## Configuration

### 1. Environment Variables

Create `.env` file on the EC2 instance:

```bash
# API Configuration
API_HOST=0.0.0.0
API_PORT=8080
API_TLS_ENABLED=false

# Vsock Configuration (IMPORTANT!)
VSOCK_CID=3          # Enclave is always CID 3
VSOCK_PORT=5000      # Must match what enclave listens on
VSOCK_TIMEOUT_MS=10000
VSOCK_RETRY_ATTEMPTS=5
VSOCK_RETRY_DELAY_MS=1000

# L3 Configuration
L3_ENDPOINT=https://l3-guardian.orbs.network
L3_TIMEOUT_MS=15000
L3_RETRY_ATTEMPTS=3

# Auth Configuration
AUTH_ENABLED=true
AUTH_API_KEY=your-secure-api-key-here
AUTH_RATE_LIMITING_ENABLED=true
AUTH_MAX_REQUESTS_PER_MINUTE=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# TAPP Identifier
TAPP_ID=production-tapp-001
```

### 2. Config File

Alternatively, use `config.production.json`:

```bash
cp config.production.json config.json
# Edit config.json with your values
```

**Critical vsock settings:**
- `vsock.cid`: Must be `3` (enclave CID)
- `vsock.port`: Must match the port your enclave listens on (default: `5000`)

### 3. Enclave Configuration

In your `orbs-tee-enclave-nitro` repository, ensure the enclave server is configured to:

```rust
// In enclave code
let listener = VsockListener::bind(
    VMADDR_CID_ANY,  // Listen on all CIDs (accepts from parent)
    5000             // Port - MUST MATCH host config!
)?;
```

## Deployment Steps

### Step 1: Build the Enclave

On your development machine or EC2 instance:

```bash
cd /path/to/orbs-tee-enclave-nitro

# Build the enclave image file (.eif)
nitro-cli build-enclave \
  --docker-uri your-enclave-docker-image:latest \
  --output-file enclave.eif

# Note the measurements (PCR0, PCR1, PCR2) - you'll need these for attestation verification
```

### Step 2: Deploy the Host

On the EC2 parent instance:

```bash
# Clone the host repository
cd /home/ec2-user
git clone https://github.com/orbs-network/orbs-tee-host.git
cd orbs-tee-host

# Install dependencies
npm ci

# Build TypeScript
npm run build

# Create production config
cp config.production.json config.json
nano config.json  # Edit as needed

# Or use environment variables
nano .env  # Create and edit
```

### Step 3: Start the Enclave

```bash
# Allocate resources for enclave (one-time)
sudo nitro-cli-config -m 4096 -t 2  # 4GB RAM, 2 vCPUs

# Start the enclave
sudo nitro-cli run-enclave \
  --eif-path /path/to/enclave.eif \
  --memory 4096 \
  --cpu-count 2 \
  --enclave-cid 3 \
  --debug-mode  # Remove in production

# Verify enclave is running
sudo nitro-cli describe-enclaves

# Check enclave console output
sudo nitro-cli console --enclave-id $(sudo nitro-cli describe-enclaves | jq -r '.[0].EnclaveID')
```

**Important**: The `--enclave-cid 3` parameter sets the enclave to CID 3, which must match your host config!

### Step 4: Start the Host

```bash
cd /home/ec2-user/orbs-tee-host

# Start the host (production)
NODE_ENV=production npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name orbs-tee-host
pm2 save
pm2 startup  # Enable auto-start on reboot
```

### Step 5: Verify Communication

```bash
# Health check
curl http://localhost:8080/api/v1/health

# Should return:
# {
#   "status": "healthy",
#   "enclaveConnected": true,
#   "l3Reachable": true,
#   "uptimeSeconds": 123
# }

# Test attestation
curl -X POST http://localhost:8080/api/v1/attest \
  -H "Content-Type: application/json" \
  -d '{"tappId": "test-tapp"}'
```

## Testing the Setup

### 1. Test Enclave Connectivity

```bash
# Ping the enclave
curl -X POST http://localhost:8080/api/v1/request \
  -H "Content-Type: application/json" \
  -d '{
    "method": "ping",
    "params": {}
  }'

# Should return:
# {
#   "success": true,
#   "data": {
#     "pong": true,
#     "timestamp": 1234567890
#   }
# }
```

### 2. Test Cryptographic Operations

```bash
# Get public key
curl -X POST http://localhost:8080/api/v1/request \
  -H "Content-Type: application/json" \
  -d '{
    "method": "get_public_key",
    "params": {}
  }'

# Sign transaction
curl -X POST http://localhost:8080/api/v1/request \
  -H "Content-Type: application/json" \
  -d '{
    "method": "sign_transaction",
    "params": {
      "data": "0xdeadbeef"
    }
  }'
```

### 3. Test Attestation Flow

```bash
# Request attestation (includes L3 submission)
curl -X POST http://localhost:8080/api/v1/attest \
  -H "Content-Type: application/json" \
  -d '{
    "tappId": "production-tapp-001"
  }'

# Should return:
# {
#   "attestationDoc": "base64-encoded-document",
#   "certificateChain": ["cert1-base64", "cert2-base64"],
#   "publicKey": "0x...",
#   "tappId": "production-tapp-001"
# }
```

## Troubleshooting

### Enclave Not Connected

**Symptom**: `"enclaveConnected": false` in health check

**Possible Causes**:

1. **Enclave not running**:
   ```bash
   sudo nitro-cli describe-enclaves
   # Should show at least one enclave
   ```

2. **Wrong CID/Port configuration**:
   ```bash
   # Check host config
   cat config.json | grep -A5 vsock

   # Check enclave is on CID 3
   sudo nitro-cli describe-enclaves | jq '.[0].EnclaveCID'
   # Should return: 3
   ```

3. **Enclave not listening on port**:
   ```bash
   # Check enclave console for startup messages
   sudo nitro-cli console --enclave-id <ENCLAVE_ID>
   # Look for: "Listening on vsock port 5000"
   ```

4. **Enclave crashed**:
   ```bash
   # Check enclave console for errors
   sudo nitro-cli console --enclave-id <ENCLAVE_ID>
   ```

### Connection Timeout

**Symptom**: Requests timeout after 10 seconds

**Solutions**:

1. Increase timeout in config:
   ```json
   {
     "vsock": {
       "timeoutMs": 30000,
       "retryAttempts": 5
     }
   }
   ```

2. Check enclave is responsive:
   ```bash
   sudo nitro-cli console --enclave-id <ENCLAVE_ID>
   ```

### L3 Submission Failing

**Symptom**: Attestation works but L3 submission fails

**Solutions**:

1. Check L3 endpoint is reachable:
   ```bash
   curl https://l3-guardian.orbs.network/health
   ```

2. Check host logs:
   ```bash
   pm2 logs orbs-tee-host
   # Or if running directly:
   tail -f /var/log/orbs-tee-host/host.log
   ```

3. Verify network connectivity from EC2 instance

### Port Mismatch

**Symptom**: "Connection refused" errors

**Diagnosis**:
```bash
# Host expects enclave on port X
grep VSOCK_PORT .env
# Or
jq '.vsock.port' config.json

# Enclave listens on port Y
sudo nitro-cli console --enclave-id <ENCLAVE_ID> | grep "Listening"
```

**Solution**: Ensure both use the same port!

## Security Considerations

### In Production

1. **Disable debug mode**:
   ```bash
   # Remove --debug-mode flag when starting enclave
   sudo nitro-cli run-enclave --eif-path enclave.eif ...
   ```

2. **Enable TLS** for the API:
   ```json
   {
     "api": {
       "tlsEnabled": true,
       "tlsCertPath": "/etc/ssl/certs/host-cert.pem",
       "tlsKeyPath": "/etc/ssl/private/host-key.pem"
     }
   }
   ```

3. **Use API authentication**:
   ```json
   {
     "auth": {
       "enabled": true,
       "apiKey": "USE_ENV_VAR_NOT_FILE"
     }
   }
   ```

4. **Restrict API access**:
   ```bash
   # Use AWS Security Groups to limit access to port 8080
   # Or use a reverse proxy (nginx) with additional auth
   ```

5. **Monitor logs**:
   ```bash
   pm2 logs orbs-tee-host
   tail -f /var/log/orbs-tee-host/host.log
   ```

## Next Steps

1. **Set up monitoring**: CloudWatch, Prometheus, or custom monitoring
2. **Configure log rotation**: logrotate for `/var/log/orbs-tee-host/`
3. **Set up alerts**: For enclave disconnections, high error rates
4. **Test failover**: What happens if enclave crashes?
5. **Benchmark performance**: Measure latency and throughput

## Additional Resources

- [AWS Nitro Enclaves Documentation](https://docs.aws.amazon.com/enclaves/)
- [Vsock Protocol](https://man7.org/linux/man-pages/man7/vsock.7.html)
- [ORBS TEE Architecture](../README.md)
