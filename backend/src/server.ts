import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { iotSimulator, WaterReading } from './services/iotSimulator';
import { iotaService } from './services/iotaService';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Store per le letture da inviare a IOTA
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
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ============ ROUTES ============

// Health check
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

// Ottieni dispositivi
app.get('/devices', (req: Request, res: Response) => {
  res.json(iotSimulator.getDevices());
});

// Ottieni letture recenti
app.get('/readings', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  res.json(iotSimulator.getAllReadings(limit));
});

// Ottieni letture per dispositivo
app.get('/readings/:deviceId', (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;
  res.json(iotSimulator.getDeviceReadings(deviceId as string, limit));
});

// Ottieni statistiche
app.get('/stats', (req: Request, res: Response) => {
  res.json(iotSimulator.getStats());
});

// Avvia/ferma simulatore
app.post('/simulator/start', (req: Request, res: Response) => {
  const interval = parseInt(req.body.interval) || 5000;
  iotSimulator.start(interval);
  res.json({ status: 'started', interval });
});

app.post('/simulator/stop', (req: Request, res: Response) => {
  iotSimulator.stop();
  res.json({ status: 'stopped' });
});

// Registra lettura su IOTA
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

// Emetti certificato
app.post('/issue-certificate', async (req: Request, res: Response) => {
  try {
    const {
      certificateNumber,
      companyName,
      periodStart,
      periodEnd,
      imageUrl,
      recipient
    } = req.body;

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

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Minta Water Tokens
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

// Query eventi IOTA
app.get('/events/:type', async (req: Request, res: Response) => {
  const { type } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const events = await iotaService.queryRecentEvents(type as string, limit);
  res.json(events);
});

// ============ EVENT HANDLERS ============

iotSimulator.on('reading', (reading: WaterReading) => {
  broadcastReading(reading);
  pendingReadings.push(reading);

  // Batch delle letture su blockchain ogni 10 letture
  if (pendingReadings.length >= 10 && !isRecordingToBlockchain) {
    recordBatchToBlockchain();
  }
});

async function recordBatchToBlockchain(): Promise<void> {
  if (pendingReadings.length === 0 || isRecordingToBlockchain) return;

  isRecordingToBlockchain = true;
  const batch = pendingReadings.splice(0, 10);

  console.log(`📤 Recording batch of ${batch.length} readings to IOTA...`);

  for (const reading of batch) {
    await iotaService.recordWaterReading(
      process.env.DEVICE_CAP_ID!,
      process.env.REGISTRY_ID!,
      reading.liters,
      reading.hash
    );
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }

  isRecordingToBlockchain = false;
  console.log('✅ Batch recorded successfully');
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
   
   Endpoints:
   - GET  /health          - Status del sistema
   - GET  /devices         - Lista dispositivi IoT
   - GET  /readings        - Letture recenti
   - GET  /stats           - Statistiche aggregate
   - POST /simulator/start - Avvia simulatore
   - POST /simulator/stop  - Ferma simulatore
   - POST /record-to-blockchain - Registra su IOTA
   - POST /issue-certificate    - Emetti certificato
   - POST /mint-tokens          - Minta Water Tokens
   
🌊 ========================================
  `);

  // Avvia il simulatore automaticamente
  const simulationInterval = parseInt(process.env.SIMULATION_INTERVAL_MS || '5000');
  iotSimulator.start(simulationInterval);
});
