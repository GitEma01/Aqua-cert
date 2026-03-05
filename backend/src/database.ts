import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'aqua-cert.db');
const db = new Database(DB_PATH);

// ── Schema — runs immediately so tables exist before prepared statements ──────

db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id   TEXT    NOT NULL,
      liters      INTEGER NOT NULL,
      timestamp   INTEGER NOT NULL,
      flow_rate   REAL    NOT NULL,
      pressure    REAL    NOT NULL,
      temperature REAL    NOT NULL,
      hash        TEXT    NOT NULL UNIQUE,
      on_chain    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_readings_device   ON readings(device_id);
    CREATE INDEX IF NOT EXISTS idx_readings_ts       ON readings(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_readings_on_chain ON readings(on_chain);

    CREATE TABLE IF NOT EXISTS certificates (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_number TEXT    NOT NULL UNIQUE,
      company_name       TEXT    NOT NULL,
      recipient_address  TEXT    NOT NULL,
      period_start       INTEGER NOT NULL,
      period_end         INTEGER NOT NULL,
      total_liters       INTEGER NOT NULL DEFAULT 0,
      total_readings     INTEGER NOT NULL DEFAULT 0,
      footprint_class    TEXT    NOT NULL DEFAULT '?',
      issued_at          INTEGER NOT NULL,
      tx_digest          TEXT,
      object_id          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_certs_recipient ON certificates(recipient_address);

    CREATE TABLE IF NOT EXISTS devices (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id     TEXT    NOT NULL UNIQUE,
      name          TEXT    NOT NULL,
      location      TEXT    NOT NULL,
      device_type   TEXT    NOT NULL,
      device_cap_id TEXT,
      registered_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      active        INTEGER NOT NULL DEFAULT 1
    );
`);

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

// ── Readings ──────────────────────────────────────────────────────────────────

const stmtInsertReading = db.prepare(`
  INSERT OR IGNORE INTO readings (device_id, liters, timestamp, flow_rate, pressure, temperature, hash, on_chain)
  VALUES (@device_id, @liters, @timestamp, @flow_rate, @pressure, @temperature, @hash, @on_chain)
`);

const stmtMarkOnChain = db.prepare(`
  UPDATE readings SET on_chain = 1 WHERE hash = ?
`);

const stmtGetReadings = db.prepare(`
  SELECT * FROM readings ORDER BY timestamp DESC LIMIT ?
`);

const stmtGetDeviceReadings = db.prepare(`
  SELECT * FROM readings WHERE device_id = ? ORDER BY timestamp DESC LIMIT ?
`);

const stmtGetStats = db.prepare(`
  SELECT device_id, COUNT(*) as readings, SUM(liters) as liters FROM readings GROUP BY device_id
`);

export function insertReading(r: Omit<DbReading, 'id'>): void {
  try {
    stmtInsertReading.run(r);
  } catch (_) { /* duplicate hash — ignore */ }
}

export function markReadingOnChain(hash: string): void {
  stmtMarkOnChain.run(hash);
}

export function getReadings(limit: number): DbReading[] {
  return stmtGetReadings.all(limit) as DbReading[];
}

export function getDeviceReadings(deviceId: string, limit: number): DbReading[] {
  return stmtGetDeviceReadings.all(deviceId, limit) as DbReading[];
}

export function getReadingStats(): {
  totalReadings: number;
  totalLiters: number;
  byDevice: Record<string, { readings: number; liters: number }>;
} {
  const rows = stmtGetStats.all() as { device_id: string; readings: number; liters: number }[];
  let totalReadings = 0;
  let totalLiters = 0;
  const byDevice: Record<string, { readings: number; liters: number }> = {};

  for (const row of rows) {
    byDevice[row.device_id] = { readings: row.readings, liters: row.liters };
    totalReadings += row.readings;
    totalLiters += row.liters;
  }

  return { totalReadings, totalLiters, byDevice };
}

// ── Certificates ──────────────────────────────────────────────────────────────

const stmtInsertCert = db.prepare(`
  INSERT OR IGNORE INTO certificates
    (certificate_number, company_name, recipient_address, period_start, period_end,
     total_liters, total_readings, footprint_class, issued_at, tx_digest, object_id)
  VALUES
    (@certificate_number, @company_name, @recipient_address, @period_start, @period_end,
     @total_liters, @total_readings, @footprint_class, @issued_at, @tx_digest, @object_id)
`);

const stmtGetCertsByRecipient = db.prepare(`
  SELECT * FROM certificates WHERE recipient_address = ? ORDER BY issued_at DESC
`);

export function insertCertificate(c: Omit<DbCertificate, 'id'>): void {
  try {
    stmtInsertCert.run(c);
  } catch (_) { /* duplicate cert number — ignore */ }
}

export function getCertificatesByRecipient(address: string): DbCertificate[] {
  return stmtGetCertsByRecipient.all(address) as DbCertificate[];
}

// ── Devices ───────────────────────────────────────────────────────────────────

const stmtInsertDevice = db.prepare(`
  INSERT OR IGNORE INTO devices (device_id, name, location, device_type, device_cap_id, active)
  VALUES (@device_id, @name, @location, @device_type, @device_cap_id, @active)
`);

const stmtUpdateDeviceCap = db.prepare(`
  UPDATE devices SET device_cap_id = ? WHERE device_id = ?
`);

const stmtGetDevices = db.prepare(`
  SELECT * FROM devices WHERE active = 1 ORDER BY registered_at ASC
`);

const stmtGetDeviceById = db.prepare(`
  SELECT * FROM devices WHERE device_id = ?
`);

export function insertDevice(d: Omit<DbDevice, 'id' | 'registered_at'>): void {
  try {
    stmtInsertDevice.run(d);
  } catch (_) { /* already exists — ignore */ }
}

export function updateDeviceCapId(deviceId: string, capId: string): void {
  stmtUpdateDeviceCap.run(capId, deviceId);
}

export function getDevices(): DbDevice[] {
  return stmtGetDevices.all() as DbDevice[];
}

export function getDeviceById(deviceId: string): DbDevice | undefined {
  return stmtGetDeviceById.get(deviceId) as DbDevice | undefined;
}
