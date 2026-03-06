# aqua-cert

Water footprint certification dApp built on the **IOTA blockchain** using Move smart contracts. Tracks IoT water sensor data, certifies water consumption, issues on-chain certificate NFTs, and mints Water Tokens.

Built for the **MasterZ × IOTA Hackathon 2025**.

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [First-Time Setup](#first-time-setup)
- [Running the App](#running-the-app)
- [Version History](#version-history)
  - [v0.1.0 — MVP](#v010--mvp)
  - [v0.2.0 — Business Upgrade](#v020--business-upgrade)
  - [v0.3.0 — Notarization + Gas Station](#v030--notarization--gas-station)
  - [v0.4.0 — GraphQL Analytics](#v040--graphql-analytics)
  - [v0.5.0 — Gas Station Fully Operational](#v050--gas-station-fully-operational)
- [API Reference](#api-reference)
- [Smart Contracts](#smart-contracts)
- [Explorer Links](#explorer-links)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
aqua-cert/
├── aqua_cert/          # Move smart contracts (IOTA testnet)
│   ├── sources/
│   │   ├── aqua_cert.move
│   │   ├── water_registry.move
│   │   ├── water_certificate.move
│   │   └── water_token.move
│   └── Move.toml
├── backend/            # Node.js + Express + WebSocket (port 3001)
│   └── src/
│       ├── server.ts
│       ├── database.ts
│       └── services/
│           ├── iotaService.ts
│           ├── iotSimulator.ts
│           ├── notarizationService.ts
│           ├── gasStationService.ts
│           └── graphqlService.ts
├── frontend/           # React + Vite + @iota/dapp-kit (port 5173)
│   └── src/
│       ├── App.tsx
│       └── components/
│           ├── Dashboard.tsx
│           ├── CertificateHistory.tsx
│           ├── DeviceManager.tsx
│           ├── NotarizationProofs.tsx
│           └── Analytics.tsx
└── scripts/
    └── deploy.sh       # Deploys contracts + writes backend/.env automatically
```

---

## Prerequisites

Install the following tools before proceeding:

| Tool | Purpose | Install |
|---|---|---|
| Node.js >= 20 | Backend + Frontend | https://nodejs.org |
| IOTA CLI (`iota`) | Deploy Move contracts | https://docs.iota.org/developer/getting-started/install-iota |
| `jq` | Used by deploy script | `sudo apt-get install -y jq` |
| Docker + docker-compose | Gas Station (v0.3.0+) | https://docs.docker.com/get-docker |
| Python 3 | Private key conversion in deploy script | Usually pre-installed |

---

## First-Time Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd aqua-cert
```

### 2. Create an IOTA wallet

```bash
iota client new-address ed25519
iota client switch --address <your-new-address>
```

Export your private key in hex format (required by the backend):

```bash
iota keytool export --key-identity <your-address> --json
```

The deploy script handles the Bech32-to-hex conversion automatically.

### 3. Fund your wallet

```bash
curl -X POST https://faucet.testnet.iota.cafe/v1/gas \
  -H "Content-Type: application/json" \
  -d '{"FixedAmountRequest":{"recipient":"<your-address>"}}'
```

### 4. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 5. Deploy smart contracts

```bash
cd ~/aqua-cert
bash scripts/deploy.sh
```

This will:
- Build and publish the Move contracts to IOTA testnet
- Create the `WaterRegistry` and capability objects
- Write all object IDs and your private key to `backend/.env` automatically

### 6. (v0.3.0+) Set up the Gas Station

See the [v0.3.0 section](#v030--notarization--gas-station) for full instructions.

---

## Running the App

```bash
# Terminal 1 — Gas Station (v0.3.0+)
cd ~/gas-station/docker
GAS_STATION_AUTH=aquacert-secret docker-compose up -d

# Terminal 2 — Backend
cd ~/aqua-cert/backend
npm run dev

# Terminal 3 — Frontend
cd ~/aqua-cert/frontend
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:5173
- Gas Station: http://localhost:9527

---

## Version History

### v0.1.0 — MVP

**Tag:** `v0.1.0-baseline`

**What it includes:**
- IoT sensor simulator (flow rate, pressure, temperature)
- Real-time WebSocket dashboard
- Record sensor readings on IOTA blockchain
- Issue `WaterCertificate` NFTs
- Mint Water Tokens

**Setup:**

1. Complete [First-Time Setup](#first-time-setup) steps 1–5.
2. Start the backend and frontend.

No gas station or SQLite persistence in this version. All state is in-memory.

**Rollback:**
```bash
git checkout v0.1.0-baseline
```

---

### v0.2.0 — Business Upgrade

**Tag:** `v0.2.0`

**What it adds over v0.1.0:**
- SQLite persistence — readings survive backend restarts (`backend/aqua-cert.db`)
- **Certificates tab** — browse `WaterCertificate` NFTs owned by the connected wallet
- **Devices tab** — device list, per-device stats, on-chain device registration form
- New endpoints: `/certificates/:address`, `/devices/register`, `/devices/:deviceId/stats`

**Setup:**

Same as v0.1.0. SQLite database is created automatically on first backend start — no extra configuration needed.

**Rollback:**
```bash
git checkout v0.2.0
```

---

### v0.3.0 — Notarization + Gas Station

**Tag:** `v0.3.0`

**What it adds over v0.2.0:**
- **IOTA Notarization** — every 10 blockchain readings trigger an on-chain batch proof anchor using `@iota/notarization` (WASM)
- **Proofs tab** — lists all batch proof anchors with IOTA explorer links
- **Gas Station backend wiring** — all transactions auto-route through the gas station when `GAS_STATION_URL` is set in `.env`
- Gas-sponsored NFT transfer endpoints

**Gas Station Setup (required for sponsored transactions):**

#### a) Add your gas station keypair to the config

The gas station needs its own IOTA keypair. Generate one:

```bash
iota keytool generate ed25519
```

This outputs a Bech32 private key. Convert it to base64 for the config:

```python
import base64, binascii

# Replace with your raw 32-byte hex private key
raw_hex = "<32-byte-hex-private-key>"
flag = b'\x00'  # ed25519 flag byte
key_bytes = flag + bytes.fromhex(raw_hex)
print(base64.b64encode(key_bytes).decode())
```

#### b) Configure the gas station

Edit `~/gas-station/docker/config.yaml`:

```yaml
keypair: "<base64-encoded-flag+privkey>"
rpc_url: "https://api.testnet.iota.cafe"
```

#### c) Pull and start the gas station

> **Important:** Do NOT build from source — use the pre-built image.

```bash
sg docker -c "docker pull iotaledger/gas-station:latest"
cd ~/gas-station/docker
GAS_STATION_AUTH=aquacert-secret docker-compose up -d
```

Verify it is running:
```bash
curl http://localhost:9527
# Expected: OK
```

#### d) Fund the gas station wallet

```bash
curl -X POST https://faucet.testnet.iota.cafe/v1/gas \
  -H "Content-Type: application/json" \
  -d '{"FixedAmountRequest":{"recipient":"<gas-station-wallet-address>"}}'
```

#### e) Update `backend/.env`

Uncomment and set:
```env
GAS_STATION_URL=http://localhost:9527
GAS_STATION_TOKEN=aquacert-secret
```

**Rollback:**
```bash
git checkout v0.3.0
```

---

### v0.4.0 — GraphQL Analytics

**Tag:** `v0.4.0`

**What it adds over v0.3.0:**
- **Analytics tab** powered by IOTA GraphQL (`https://graphql.testnet.iota.cafe`)
  - 4 stat cards: total certificates, total liters, unique owners, total readings
  - Footprint class bar chart (A–E, colour-coded)
  - Recent `CertificateIssued` events timeline
  - Global certificate grid across all wallets (not just the connected one)
- `graphqlService.ts` — paginated GraphQL queries for objects and events

**Setup:**

No extra configuration needed. The GraphQL endpoint is public and queried directly from the backend. Note: it is rate-limited — avoid hammering it in development.

**Rollback:**
```bash
git checkout v0.4.0
```

---

### v0.5.0 — Gas Station Fully Operational

**Tag:** `v0.5.0`

**What it adds over v0.4.0:**
- Gas Station confirmed working end-to-end with Docker
- **Certificate History tab** — gas-free NFT transfer UI: the user signs with their wallet (no IOTA balance needed), the gas station pays all fees
- Gas station status badge in the frontend (purple Zap icon — shows live `healthy` / `unavailable`)
- `/gas-station/status` endpoint returns `{ available: true, healthy: true }` when running

**Setup:**

Follow all steps from [v0.3.0 Gas Station Setup](#v030--notarization--gas-station) above. This version requires the gas station to be running for transfers to work. The app degrades gracefully if the gas station is offline (transfers are disabled, status badge turns grey).

**Rollback:**
```bash
git checkout v0.5.0
```

---

## API Reference

### Core

| Method | Path | Description |
|---|---|---|
| GET | `/health` | System status, IOTA address, balance |
| GET | `/devices` | List IoT devices |
| GET | `/readings` | Recent sensor readings |
| GET | `/readings/:deviceId` | Readings for a specific device |
| GET | `/stats` | Aggregate statistics |
| POST | `/simulator/start` | Start IoT simulator (`{ interval }`) |
| POST | `/simulator/stop` | Stop IoT simulator |
| POST | `/record-to-blockchain` | Record a water reading on IOTA |
| POST | `/issue-certificate` | Issue a WaterCertificate NFT |
| POST | `/mint-tokens` | Mint Water Tokens |
| GET | `/events/:type` | Query recent on-chain events |

### v0.2.0+

| Method | Path | Description |
|---|---|---|
| GET | `/certificates/:address` | WaterCertificate NFTs owned by an address |
| POST | `/devices/register` | Register new device on-chain |
| GET | `/devices/:deviceId/stats` | Per-device stats (count, liters, last reading) |

### v0.3.0+

| Method | Path | Description |
|---|---|---|
| GET | `/notarizations` | All anchored batch proofs |
| GET | `/notarizations/:hash` | Proof for a specific data hash |
| POST | `/notarizations/anchor` | Manually anchor a hash |
| GET | `/gas-station/status` | `{ available, healthy }` |
| POST | `/gas-station/prepare-transfer` | Prepare sponsored NFT transfer tx |
| POST | `/gas-station/execute` | Relay signed tx to gas station |

### v0.4.0+

| Method | Path | Description |
|---|---|---|
| GET | `/graphql/certificates` | All WaterCertificate objects (all wallets) |
| GET | `/graphql/analytics` | Aggregated stats |
| GET | `/graphql/events/certificates` | Last 50 CertificateIssued events |
| GET | `/graphql/events/readings` | Last 50 ReadingRecorded events |

---

## Smart Contracts

Written in **Move** for the IOTA framework.

| Module | Object | Purpose |
|---|---|---|
| `water_registry` | `AdminCap` | Admin authority |
| `water_registry` | `WaterRegistry` | Holds devices and readings |
| `water_registry` | `DeviceCap` | Per-device authority |
| `water_certificate` | `CertifierCap` | Issue certificate NFTs |
| `water_token` | `TreasuryCap` | Mint Water Tokens |

Before publishing, `Move.toml` must have `aqua_cert = "0x0"`. The deploy script handles this automatically.

### `backend/.env` variables

```env
IOTA_NETWORK_URL=https://api.testnet.iota.cafe
PACKAGE_ID=<from deploy>
ADMIN_CAP_ID=<from deploy>
DEVICE_CAP_ID=<from deploy>
REGISTRY_ID=<from deploy>
CERTIFIER_CAP_ID=<from deploy>
TREASURY_CAP_ID=<from deploy>
TOKEN_INFO_ID=<from deploy>
PRIVATE_KEY=<hex format, 32 bytes — deploy script sets this automatically>
PORT=3001
SIMULATION_INTERVAL_MS=5000

# Gas Station (v0.3.0+ — uncomment when running)
# GAS_STATION_URL=http://localhost:9527
# GAS_STATION_TOKEN=aquacert-secret
```

---

## Explorer Links

| Type | URL |
|---|---|
| Transaction | `https://explorer.rebased.iota.org/transaction/<DIGEST>?network=testnet` |
| Object | `https://explorer.rebased.iota.org/object/<OBJECT_ID>?network=testnet` |

---

## Troubleshooting

### Deploy script fails with `jq` parse error
The IOTA CLI prints `[warn]` and `[note]` lines before JSON output. The deploy script filters these with `sed '/^\[/d'` — make sure you are using the latest version of the script.

### `PRIVATE_KEY` format error on backend start
The backend requires a 32-byte hex private key. `iota keytool export` returns Bech32. Run the deploy script — it converts automatically via Python.

### Gas station returns 401
Check that `GAS_STATION_TOKEN` in `backend/.env` matches `GAS_STATION_AUTH` used when starting Docker:
```bash
GAS_STATION_AUTH=aquacert-secret docker-compose up -d
```

### `docker-compose` fails to build gas station image
Do NOT build from source. Pull the pre-built image first:
```bash
sg docker -c "docker pull iotaledger/gas-station:latest"
```

### Notarization WASM signing error
- `iotaPublicKeyBytes()` must return 33 bytes: `[flag(0x00) | raw_32_bytes]`
- Use `keypair.signTransaction(txDataBcs).signature` — NOT `keypair.sign()` (which skips intent prefix + blake2b)

### Gas station wallet is out of funds
```bash
curl -X POST https://faucet.testnet.iota.cafe/v1/gas \
  -H "Content-Type: application/json" \
  -d '{"FixedAmountRequest":{"recipient":"<gas-station-wallet-address>"}}'
```

### Backend wallet is out of funds
```bash
curl -X POST https://faucet.testnet.iota.cafe/v1/gas \
  -H "Content-Type: application/json" \
  -d '{"FixedAmountRequest":{"recipient":"<backend-wallet-address>"}}'
```
