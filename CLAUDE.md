# CLAUDE.md — aqua-cert

## Project Overview

**aqua-cert** is a water certification dApp built on the **IOTA blockchain** using the Move smart contract language. It tracks IoT water sensor data, certifies water consumption, issues on-chain certificates, and mints Water Tokens.

---

## Architecture

```
aqua-cert/
├── aqua_cert/          # Move smart contracts
│   ├── sources/
│   │   ├── aqua_cert.move          # Main entry / init
│   │   ├── water_registry.move     # Device & registry management
│   │   ├── water_certificate.move  # Certificate NFT logic
│   │   └── water_token.move        # Water Token (fungible)
│   └── Move.toml
├── backend/            # Node.js + Express + WebSocket (port 3001)
│   └── src/
│       ├── server.ts               # Main server, REST + WS
│       └── services/
│           ├── iotaService.ts      # IOTA SDK calls
│           └── iotSimulator.ts     # IoT sensor simulator
├── frontend/           # React + Vite + @iota/dapp-kit (port 5173)
└── scripts/
    └── deploy.sh       # Full deploy: contracts + .env auto-config
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Move (IOTA framework, testnet) |
| Blockchain SDK | `@iota/iota-sdk` |
| Backend | Node.js, Express 5, TypeScript, WebSocket (`ws`) |
| Frontend | React 19, Vite, Tailwind CSS, `@iota/dapp-kit`, Recharts |
| Dev tools | nodemon, ts-node, eslint |

---

## Commands to Activate the Service

### 1. Deploy Smart Contracts (first time / after contract changes)
```bash
cd ~/aqua-cert
bash scripts/deploy.sh
```
This builds and publishes Move contracts, creates the WaterRegistry, registers a device, and writes all object IDs to `backend/.env` automatically.

### 2. Start the Backend
```bash
cd ~/aqua-cert/backend
npm run dev        # development (nodemon + ts-node)
# or
npm run build && npm start   # production
```
Server starts on **http://localhost:3001** with WebSocket support.
The IoT simulator starts automatically on launch (default interval: 5 000 ms).

### 3. Start the Frontend
```bash
cd ~/aqua-cert/frontend
npm run dev
```
Opens on **http://localhost:5173**

---

## Backend API Endpoints

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
| POST | `/issue-certificate` | Issue a water certificate NFT |
| POST | `/mint-tokens` | Mint Water Tokens |
| GET | `/events/:type` | Query recent on-chain events |

---

## Backend `.env` Variables

```env
IOTA_NETWORK_URL=https://api.testnet.iota.cafe
PACKAGE_ID=<from deploy>
ADMIN_CAP_ID=<from deploy>
DEVICE_CAP_ID=<from deploy>
REGISTRY_ID=<from deploy>
CERTIFIER_CAP_ID=<from deploy>
TREASURY_CAP_ID=<from deploy>
TOKEN_INFO_ID=<from deploy>
PRIVATE_KEY=<hex decoded from iota keytool export>
PORT=3001
SIMULATION_INTERVAL_MS=5000
```

### Currently Deployed (Testnet) — as of 2026-03-05

```
PACKAGE_ID=0xda662b16ff8423f9bb6033d9fa0823e1ffee1454efc39de8fc0acd3228cc4e0f
ADMIN_CAP_ID=0x0abdff50a5fd3bdda8797bd1e7945008a22b5c603eeecca242c930d79a59299b
DEVICE_CAP_ID=0x64bb1b0f4b051dde47ef6a62e942a57e925c372774aa06584ebdc5dfd036fc5d
REGISTRY_ID=0xba439791e8207364d8002fe6dcfcb025bb90a131d18c73839bee6f389bc46b83
CERTIFIER_CAP_ID=0xca4209115ff17b0d845dd0f38eafc845f5e6dde31a3a73396aecb5e28202fe57
TREASURY_CAP_ID=0x273abd395aafe316d49c6f0dbf8daa9f23383da86e42e60786af34471a7b59c4
TOKEN_INFO_ID=0x49c446843d8bf4eecb89956df92f54de7eb34288a915ff677fd301baafd0248f
Backend address: 0x7b94665f11a112e1068b2c333d9e962a2cb1422a767245aa337384335db1601c
```

### Deploy Script Requirements
- `jq` must be installed: `sudo apt-get install -y jq`
- `PRIVATE_KEY` in `.env` must be **hex format** (32 bytes), not Bech32. The deploy script handles conversion via Python.

---

## Smart Contract Key Objects

| Object | Module | Purpose |
|---|---|---|
| `AdminCap` | water_registry | Admin authority |
| `CertifierCap` | water_certificate | Issue certificates |
| `TreasuryCap` | water_token | Mint Water Tokens |
| `WaterRegistry` | water_registry | Holds devices & readings |
| `DeviceCap` | water_registry | Per-device authority |

---

## Git Versions (Rollback Tags)

| Tag | State |
|---|---|
| `v0.1.0-baseline` | Original working MVP — IoT simulator, WebSocket dashboard, single certificate issuance |
| `v0.2.0` | Business upgrade — SQLite persistence, Certificate History tab, Device Management tab |

**Rollback command:** `git checkout <tag>`

---

## Business Features (v0.2.0)

### New frontend tabs
- **Dashboard** — original real-time view (unchanged)
- **Certificates** — shows all WaterCertificate NFTs owned by connected wallet (queries on-chain via `GET /certificates/:address`)
- **Devices** — lists all IoT devices with live stats; per-device detail panel; on-chain device registration form

### SQLite persistence
- DB file: `backend/aqua-cert.db` (excluded from git)
- All IoT readings written to SQLite on every tick — survive backend restarts
- Certificates and devices also persisted locally as cache

### New backend endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/certificates/:address` | WaterCertificate NFTs owned by IOTA address |
| POST | `/devices/register` | Register new device on-chain (`{ deviceId, name, location, deviceType }`) |
| GET | `/devices/:deviceId/stats` | Per-device reading count, liters, last reading |

### Key implementation files
- `backend/src/database.ts` — SQLite schema + all query helpers
- `frontend/src/components/CertificateHistory.tsx` — certificate card grid
- `frontend/src/components/DeviceManager.tsx` — device list + registration form

---

## Development Notes

- Readings are batched: every 10 sensor readings are written to the blockchain in one batch.
- WebSocket broadcasts each reading in real time to connected frontend clients.
- IOTA testnet faucet: https://faucet.testnet.iota.cafe
- Move contract addresses are set in `aqua_cert/Move.toml` (`aqua_cert = "0x0"` before publish).
- `GET /readings/:deviceId` returns `WaterReading[]` shape: `{ deviceId, liters, timestamp, rawData: { flowRate, pressure, temperature }, hash }` — note camelCase fields.
