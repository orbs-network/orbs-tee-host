# Quick Start Guide - ORBS TEE Host

Fast setup guide for deploying to AWS Nitro Enclaves.

## TL;DR - Vsock Explained

**Vsock = Virtual Socket for VM-to-Host Communication**

```
CID 2 (Parent EC2) ←──vsock──→ CID 3 (Enclave)
     Host                           Server
   connects to                   listens on
   CID 3, Port 5000              Port 5000
```

- **CID 3** is always the enclave
- **Port 5000** is configurable (must match on both sides)
- No network needed - memory-based communication

## Prerequisites Checklist

- [ ] EC2 instance with Nitro Enclave support (c5.xlarge, m5.xlarge, etc.)
- [ ] Nitro CLI installed
- [ ] Node.js 18+ installed
- [ ] Enclave built and ready (`.eif` file)

## 5-Minute Setup

### 1. Start the Enclave

```bash
# Allocate resources
sudo nitro-cli-config -m 4096 -t 2

# Run enclave (CID 3, Port 5000)
sudo nitro-cli run-enclave \
  --eif-path /path/to/enclave.eif \
  --memory 4096 \
  --cpu-count 2 \
  --enclave-cid 3

# Verify it's running
sudo nitro-cli describe-enclaves
```

### 2. Configure the Host

```bash
cd /home/ec2-user/orbs-tee-host

# Option A: Environment variables
cat > .env <<EOF
VSOCK_CID=3
VSOCK_PORT=5000
L3_ENDPOINT=https://l3-guardian.orbs.network
TAPP_ID=my-tapp-id
EOF

# Option B: Config file
cp config.production.json config.json
nano config.json  # Edit vsock.cid and vsock.port
```

### 3. Build and Start

```bash
# Install and build
npm ci
npm run build

# Start
npm start

# Or use PM2
pm2 start dist/index.js --name orbs-tee-host
```

### 4. Test

```bash
# Health check
curl http://localhost:8080/api/v1/health

# Ping enclave
curl -X POST http://localhost:8080/api/v1/request \
  -H "Content-Type: application/json" \
  -d '{"method":"ping","params":{}}'

# Get attestation
curl -X POST http://localhost:8080/api/v1/attest \
  -H "Content-Type: application/json" \
  -d '{"tappId":"test"}'
```

## Critical Configuration

### Vsock Settings (MUST MATCH!)

**Host config** (`config.json`):
```json
{
  "vsock": {
    "cid": 3,      ← Enclave CID (always 3)
    "port": 5000   ← Must match enclave port!
  }
}
```

**Enclave code** (Rust):
```rust
VsockListener::bind(VMADDR_CID_ANY, 5000)  ← Same port!
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `enclaveConnected: false` | Check enclave is running: `sudo nitro-cli describe-enclaves` |
| Connection timeout | Increase `vsock.timeoutMs` in config |
| Port mismatch | Verify host and enclave use same port |
| Enclave crashed | Check logs: `sudo nitro-cli console --enclave-id <ID>` |

## Architecture

```
┌────────────────────────────────────┐
│       EC2 Parent (CID 2)           │
│                                    │
│  [TEE Host :8080]                  │
│       │                            │
│       │ vsock                      │
│       ▼                            │
│  [Nitro Enclave (CID 3:5000)]      │
│       │                            │
│       └──generates──→ Attestation  │
│                           │        │
│                           ▼        │
│                      L3 Guardians  │
└────────────────────────────────────┘
```

## Full Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive guide.
