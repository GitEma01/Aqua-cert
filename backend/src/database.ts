// In-memory database — replaces better-sqlite3 for hosted environments.
// Identical exported API; data resets on server restart (acceptable for demo).

// no-op kept for backward compatibility with server.ts import
export function initDb(): void {}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DbReading {
  id: number;
  device_id: string;
  liters: number;
  timestamp: number;
  flow_rate: number;
  pressure: number;
  temperature: number;
  hash: string;
  on_chain: 0 | 1;
}

export interface DbCertificate {
  id: number;
  certificate_number: string;
  company_name: string;
  recipient_address: string;
  period_start: number;
  period_end: number;
  total_liters: number;
  total_readings: number;
  footprint_class: string;
  issued_at: number;
  tx_digest: string | null;
  object_id: string | null;
}

export interface DbDevice {
  id: number;
  device_id: string;
  name: string;
  location: string;
  device_type: string;
  device_cap_id: string | null;
  registered_at: number;
  active: number;
}

export interface DeviceWithStats extends DbDevice {
  readings: number;
  liters: number;
}

export interface DbNotarization {
  id: number;
  batch_hash: string;
  description: string;
  object_id: string | null;
  tx_digest: string | null;
  anchored_at: number;
  gas_station: 0 | 1;
}

// ── In-memory stores ───────────────────────────────────────────────────────────

let readingSeq = 0;
let certSeq = 0;
let deviceSeq = 0;
let notarizationSeq = 0;

const readings: DbReading[] = [];
const certificates: DbCertificate[] = [];
const devices: DbDevice[] = [];
const notarizations: DbNotarization[] = [];

const readingHashes = new Set<string>();
const certNumbers = new Set<string>();
const deviceIds = new Set<string>();
const notarizationHashes = new Set<string>();

// ── Readings ──────────────────────────────────────────────────────────────────

export function insertReading(r: Omit<DbReading, 'id'>): void {
  if (readingHashes.has(r.hash)) return;
  readingHashes.add(r.hash);
  readings.push({ ...r, id: ++readingSeq });
  if (readings.length > 1000) readings.shift(); // cap at 1000 in memory
}

export function markReadingOnChain(hash: string): void {
  const r = readings.find(x => x.hash === hash);
  if (r) r.on_chain = 1;
}

export function getReadings(limit: number): DbReading[] {
  return [...readings].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export function getDeviceReadings(deviceId: string, limit: number): DbReading[] {
  return readings
    .filter(r => r.device_id === deviceId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export function getReadingStats(): {
  totalReadings: number;
  totalLiters: number;
  byDevice: Record<string, { readings: number; liters: number }>;
} {
  const byDevice: Record<string, { readings: number; liters: number }> = {};
  let totalReadings = 0;
  let totalLiters = 0;
  for (const r of readings) {
    if (!byDevice[r.device_id]) byDevice[r.device_id] = { readings: 0, liters: 0 };
    byDevice[r.device_id].readings++;
    byDevice[r.device_id].liters += r.liters;
    totalReadings++;
    totalLiters += r.liters;
  }
  return { totalReadings, totalLiters, byDevice };
}

// ── Certificates ──────────────────────────────────────────────────────────────

export function insertCertificate(c: Omit<DbCertificate, 'id'>): void {
  if (certNumbers.has(c.certificate_number)) return;
  certNumbers.add(c.certificate_number);
  certificates.push({ ...c, id: ++certSeq });
}

export function getCertificatesByRecipient(address: string): DbCertificate[] {
  return certificates
    .filter(c => c.recipient_address === address)
    .sort((a, b) => b.issued_at - a.issued_at);
}

// ── Devices ───────────────────────────────────────────────────────────────────

export function insertDevice(d: Omit<DbDevice, 'id' | 'registered_at'>): void {
  if (deviceIds.has(d.device_id)) return;
  deviceIds.add(d.device_id);
  devices.push({ ...d, id: ++deviceSeq, registered_at: Date.now() });
}

export function updateDeviceCapId(deviceId: string, capId: string): void {
  const d = devices.find(x => x.device_id === deviceId);
  if (d) d.device_cap_id = capId;
}

export function getDevices(): DbDevice[] {
  return devices.filter(d => d.active === 1).sort((a, b) => a.registered_at - b.registered_at);
}

export function getDeviceById(deviceId: string): DbDevice | undefined {
  return devices.find(d => d.device_id === deviceId);
}

// ── Notarizations ─────────────────────────────────────────────────────────────

export function insertNotarization(n: Omit<DbNotarization, 'id'>): void {
  if (notarizationHashes.has(n.batch_hash)) return;
  notarizationHashes.add(n.batch_hash);
  notarizations.push({ ...n, id: ++notarizationSeq });
}

export function getNotarizations(limit: number = 50): DbNotarization[] {
  return [...notarizations].sort((a, b) => b.anchored_at - a.anchored_at).slice(0, limit);
}

export function getNotarizationByHash(hash: string): DbNotarization | undefined {
  return notarizations.find(n => n.batch_hash === hash);
}
