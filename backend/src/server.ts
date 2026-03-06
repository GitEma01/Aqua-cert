import crypto from 'crypto';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { iotSimulator, WaterReading } from './services/iotSimulator';
import { iotaService } from './services/iotaService';
import {
  initDb,
  markReadingOnChain,
  insertCertificate,
  insertDevice,
  getDevices,
  getDeviceById,
  getDeviceReadings,
  getReadingStats,
  updateDeviceCapId,
  DeviceWithStats,
  insertNotarization,
  getNotarizations,
  getNotarizationByHash
} from './database';
import { notarizationService } from './services/notarizationService';

dotenv.config();

// Initialise SQLite (idempotent — safe on every restart)
initDb();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Pending readings buffer for blockchain batching
const pendingReadings: WaterReading[] = [];
let isRecordingToBlockchain = false;

// ============ WEBSOCKET ============

const clients: Set<WebSocket> = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('🔌 New WebSocket connection');
  ws.on('close', () => {
    clients.delete(ws);
    console.log('🔌 WebSocket disconnected');
  });
});

function broadcastReading(reading: WaterReading): void {
  const message = JSON.stringify({ type: 'reading', data: reading });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}

function broadcastNotarization(batchHash: string, result: { digest?: string; objectId?: string }): void {
  const message = JSON.stringify({ type: 'notarization', data: { batchHash, ...result } });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}

// ============ ROUTES ============

app.get('/health', async (req: Request, res: Response) => {
  try {
    const address = await iotaService.getAddress();
    const balance = await iotaService.getBalance();
    res.json({
      status: 'ok',
      iotaAddress: address,
      balance: balance.toString(),
      simulator: iotSimulator ? 'running' : 'stopped',
      pendingReadings: pendingReadings.length
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/devices', (req: Request, res: Response) => {
  const dbDevices = getDevices();
  const stats = getReadingStats();
  const result: DeviceWithStats[] = dbDevices.map(d => ({
    ...d,
    readings: stats.byDevice[d.device_id]?.readings ?? 0,
    liters: stats.byDevice[d.device_id]?.liters ?? 0
  }));
  res.json(result);
});

app.get('/devices/:deviceId/stats', (req: Request, res: Response) => {
  const deviceId = req.params.deviceId as string;
  const device = getDeviceById(deviceId);
  if (!device) return res.status(404).json({ error: 'Device not found' }) as any;
  const stats = getReadingStats();
  const lastReadings = getDeviceReadings(deviceId, 1);
  res.json({
    device,
    readings: stats.byDevice[deviceId]?.readings ?? 0,
    liters: stats.byDevice[deviceId]?.liters ?? 0,
    lastReading: lastReadings[0] ?? null
  });
});

app.post('/devices/register', async (req: Request, res: Response) => {
  const { deviceId, name, location, deviceType } = req.body;
  if (!deviceId || !name || !location || !deviceType) {
    return res.status(400).json({ success: false, error: 'Missing required fields: deviceId, name, location, deviceType' }) as any;
  }
  const validTypes = ['irrigation', 'industrial', 'datacenter'];
  if (!validTypes.includes(deviceType)) {
    return res.status(400).json({ success: false, error: `Invalid deviceType. Must be one of: ${validTypes.join(', ')}` }) as any;
  }
  try {
    const result = await iotaService.registerDevice(
      process.env.ADMIN_CAP_ID!,
      process.env.REGISTRY_ID!,
      deviceId,
      location,
      deviceType
    );
    if (result.success) {
      insertDevice({ device_id: deviceId, name, location, device_type: deviceType, device_cap_id: result.objectId ?? null, active: 1 });
      if (result.objectId) updateDeviceCapId(deviceId, result.objectId);
      iotSimulator.addDevice({ id: deviceId, name, location, type: deviceType as any, baseFlowRate: 500, variance: 0.3 });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/readings', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  res.json(iotSimulator.getAllReadings(limit));
});

app.get('/readings/:deviceId', (req: Request, res: Response) => {
  const deviceId = req.params.deviceId as string;
  const limit = parseInt(req.query.limit as string) || 100;
  res.json(iotSimulator.getDeviceReadings(deviceId, limit));
});

app.get('/stats', (req: Request, res: Response) => {
  res.json(iotSimulator.getStats());
});

app.post('/simulator/start', (req: Request, res: Response) => {
  const interval = parseInt(req.body.interval) || 5000;
  iotSimulator.start(interval);
  res.json({ status: 'started', interval });
});

app.post('/simulator/stop', (req: Request, res: Response) => {
  iotSimulator.stop();
  res.json({ status: 'stopped' });
});

app.post('/record-to-blockchain', async (req: Request, res: Response) => {
  try {
    const { deviceCapId, registryId, liters, dataHash } = req.body;
    const result = await iotaService.recordWaterReading(
      deviceCapId || process.env.DEVICE_CAP_ID!,
      registryId || process.env.REGISTRY_ID!,
      liters,
      dataHash
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/issue-certificate', async (req: Request, res: Response) => {
  try {
    const { certificateNumber, companyName, periodStart, periodEnd, imageUrl, recipient } = req.body;
    const result = await iotaService.issueCertificate(
      process.env.CERTIFIER_CAP_ID!,
      process.env.REGISTRY_ID!,
      certificateNumber,
      companyName,
      periodStart,
      periodEnd,
      imageUrl || '',
      recipient
    );
    if (result.success) {
      const stats = getReadingStats();
      insertCertificate({
        certificate_number: certificateNumber,
        company_name: companyName,
        recipient_address: recipient,
        period_start: periodStart,
        period_end: periodEnd,
        total_liters: stats.totalLiters,
        total_readings: stats.totalReadings,
        footprint_class: result.footprintClass ?? '?',
        issued_at: Date.now(),
        tx_digest: result.digest ?? null,
        object_id: result.objectId ?? null
      });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/mint-tokens', async (req: Request, res: Response) => {
  try {
    const { amount, recipient, reason } = req.body;
    const result = await iotaService.mintWaterTokens(
      process.env.TREASURY_CAP_ID!,
      process.env.TOKEN_INFO_ID!,
      amount,
      recipient,
      reason
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/certificates/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const certs = await iotaService.getCertificatesByOwner(address);
    res.json(certs);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/events/:type', async (req: Request, res: Response) => {
  const { type } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const events = await iotaService.queryRecentEvents(type as string, limit);
  res.json(events);
});

app.get('/notarizations', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  res.json(getNotarizations(limit));
});

app.get('/notarizations/:hash', (req: Request, res: Response) => {
  const hash = req.params.hash as string;
  const record = getNotarizationByHash(hash);
  if (!record) return res.status(404).json({ error: 'Notarization not found' }) as any;
  res.json(record);
});

// Manually trigger a notarization anchor (for demo / testing)
app.post('/notarizations/anchor', async (req: Request, res: Response) => {
  const { dataHash, description } = req.body;
  if (!dataHash) return res.status(400).json({ error: 'dataHash required' }) as any;

  const desc = description ?? `Manual anchor @ ${new Date().toISOString()}`;
  const useGasStation = !!process.env.GAS_STATION_URL;
  const result = useGasStation
    ? await notarizationService.notarizeWithGasStation(dataHash, desc)
    : await notarizationService.notarizeBatchHash(dataHash, desc);

  if (result.success) {
    insertNotarization({
      batch_hash: dataHash,
      description: desc,
      object_id: result.objectId ?? null,
      tx_digest: result.digest ?? null,
      anchored_at: Date.now(),
      gas_station: useGasStation ? 1 : 0
    });
  }
  res.json(result);
});

// Gas station status endpoint — lets frontend know if gas sponsorship is available
app.get('/gas-station/status', (req: Request, res: Response) => {
  res.json({
    available: !!process.env.GAS_STATION_URL,
    url: process.env.GAS_STATION_URL ?? null
  });
});

// ============ EVENT HANDLERS ============

iotSimulator.on('reading', (reading: WaterReading) => {
  broadcastReading(reading);
  pendingReadings.push(reading);
  if (pendingReadings.length >= 10 && !isRecordingToBlockchain) {
    recordBatchToBlockchain();
  }
});

async function recordBatchToBlockchain(): Promise<void> {
  if (pendingReadings.length === 0 || isRecordingToBlockchain) return;

  isRecordingToBlockchain = true;
  const batch = pendingReadings.splice(0, 10);
  console.log(`📤 Recording batch of ${batch.length} readings to IOTA...`);

  const recordedHashes: string[] = [];

  for (const reading of batch) {
    const result = await iotaService.recordWaterReading(
      process.env.DEVICE_CAP_ID!,
      process.env.REGISTRY_ID!,
      reading.liters,
      reading.hash
    );
    if (result.success) {
      markReadingOnChain(reading.hash);
      recordedHashes.push(reading.hash);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Anchor the batch as a Locked notarization on IOTA (uses gas station if configured)
  if (recordedHashes.length > 0) {
    const batchHash = computeBatchHash(recordedHashes);
    const description = `Aqua-Cert IoT batch — ${recordedHashes.length} readings @ ${new Date().toISOString()}`;
    const useGasStation = !!process.env.GAS_STATION_URL;
    const notarResult = useGasStation
      ? await notarizationService.notarizeWithGasStation(batchHash, description)
      : await notarizationService.notarizeBatchHash(batchHash, description);

    if (notarResult.success) {
      insertNotarization({
        batch_hash: batchHash,
        description,
        object_id: notarResult.objectId ?? null,
        tx_digest: notarResult.digest ?? null,
        anchored_at: Date.now(),
        gas_station: useGasStation ? 1 : 0
      });
      // Broadcast notarization event to WebSocket clients
      broadcastNotarization(batchHash, notarResult);
    }
  }

  isRecordingToBlockchain = false;
  console.log('✅ Batch recorded and notarized successfully');
}

function computeBatchHash(hashes: string[]): string {
  return crypto
    .createHash('sha256')
    .update(hashes.join(','))
    .digest('hex');
}

// ============ START SERVER ============

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`
🌊 ========================================
   AQUA-CERT BACKEND SERVER
   ========================================

   🚀 Server running on port ${PORT}
   📡 WebSocket ready for real-time data
   🗄️  SQLite persistence active

   Endpoints:
   - GET  /health                  - System status
   - GET  /devices                 - IoT devices with stats
   - GET  /devices/:id/stats       - Per-device stats
   - POST /devices/register        - Register new device on-chain
   - GET  /readings                - Recent readings (from DB)
   - GET  /readings/:deviceId      - Device readings
   - GET  /stats                   - Aggregate statistics
   - POST /simulator/start         - Start simulator
   - POST /simulator/stop          - Stop simulator
   - POST /record-to-blockchain    - Record reading on IOTA
   - POST /issue-certificate       - Issue certificate NFT
   - POST /mint-tokens             - Mint Water Tokens
   - GET  /certificates/:address   - Certificates for wallet
   - GET  /events/:type            - Query on-chain events
   - GET  /notarizations           - IOTA-anchored batch proofs
   - GET  /notarizations/:hash     - Single notarization by hash
   - POST /notarizations/anchor    - Manual notarization anchor
   - GET  /gas-station/status      - Gas station availability

🌊 ========================================
  `);

  const simulationInterval = parseInt(process.env.SIMULATION_INTERVAL_MS || '5000');
  iotSimulator.start(simulationInterval);
});
