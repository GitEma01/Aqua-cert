import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'aqua-cert.db');
const db = new Database(DB_PATH);

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT    NOT NULL,
    liters      REAL    NOT NULL,
    timestamp   INTEGER NOT NULL,
    flow_rate   REAL    NOT NULL,
    pressure    REAL    NOT NULL,
    temperature REAL    NOT NULL,
    hash        TEXT    NOT NULL UNIQUE,
    on_chain    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    certificate_number TEXT    NOT NULL UNIQUE,
    company_name       TEXT    NOT NULL,
    recipient_address  TEXT    NOT NULL,
    period_start       INTEGER NOT NULL,
    period_end         INTEGER NOT NULL,
    total_liters       REAL    NOT NULL,
    total_readings     INTEGER NOT NULL,
    footprint_class    TEXT    NOT NULL,
    issued_at          INTEGER NOT NULL,
    tx_digest          TEXT,
    object_id          TEXT
  );

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

  CREATE TABLE IF NOT EXISTS notarizations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_hash  TEXT    NOT NULL UNIQUE,
    description TEXT    NOT NULL,
    object_id   TEXT,
    tx_digest   TEXT,
    anchored_at INTEGER NOT NULL,
    gas_station INTEGER NOT NULL DEFAULT 0
  );
`);

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

// ── Init (no-op — schema runs at module load) ─────────────────────────────────

export function initDb(): void {}

// ── Readings ──────────────────────────────────────────────────────────────────

const stmtInsertReading = db.prepare<Omit<DbReading, 'id'>>(`
  INSERT OR IGNORE INTO readings
    (device_id, liters, timestamp, flow_rate, pressure, temperature, hash, on_chain)
  VALUES
    (@device_id, @liters, @timestamp, @flow_rate, @pressure, @temperature, @hash, @on_chain)
`);

export function insertReading(r: Omit<DbReading, 'id'>): void {
  stmtInsertReading.run(r);
}

const stmtMarkOnChain = db.prepare<{ hash: string }>(`
  UPDATE readings SET on_chain = 1 WHERE hash = @hash
`);

export function markReadingOnChain(hash: string): void {
  stmtMarkOnChain.run({ hash });
}

const stmtGetReadings = db.prepare<{ limit: number }>(`
  SELECT * FROM readings ORDER BY timestamp DESC LIMIT @limit
`);

export function getReadings(limit: number): DbReading[] {
  return stmtGetReadings.all({ limit }) as DbReading[];
}

const stmtGetDeviceReadings = db.prepare<{ device_id: string; limit: number }>(`
  SELECT * FROM readings WHERE device_id = @device_id ORDER BY timestamp DESC LIMIT @limit
`);

export function getDeviceReadings(deviceId: string, limit: number): DbReading[] {
  return stmtGetDeviceReadings.all({ device_id: deviceId, limit }) as DbReading[];
}

const stmtReadingStats = db.prepare(`
  SELECT device_id, COUNT(*) as readings, SUM(liters) as liters
  FROM readings GROUP BY device_id
`);

const stmtTotals = db.prepare(`
  SELECT COUNT(*) as totalReadings, SUM(liters) as totalLiters FROM readings
`);

export function getReadingStats(): {
  totalReadings: number;
  totalLiters: number;
  byDevice: Record<string, { readings: number; liters: number }>;
} {
  const rows = stmtReadingStats.all() as { device_id: string; readings: number; liters: number }[];
  const totals = stmtTotals.get() as { totalReadings: number; totalLiters: number };
  const byDevice: Record<string, { readings: number; liters: number }> = {};
  for (const row of rows) {
    byDevice[row.device_id] = { readings: row.readings, liters: row.liters ?? 0 };
  }
  return {
    totalReadings: totals.totalReadings ?? 0,
    totalLiters: totals.totalLiters ?? 0,
    byDevice
  };
}

// ── Certificates ──────────────────────────────────────────────────────────────

const stmtInsertCert = db.prepare<Omit<DbCertificate, 'id'>>(`
  INSERT OR IGNORE INTO certificates
    (certificate_number, company_name, recipient_address, period_start, period_end,
     total_liters, total_readings, footprint_class, issued_at, tx_digest, object_id)
  VALUES
    (@certificate_number, @company_name, @recipient_address, @period_start, @period_end,
     @total_liters, @total_readings, @footprint_class, @issued_at, @tx_digest, @object_id)
`);

export function insertCertificate(c: Omit<DbCertificate, 'id'>): void {
  stmtInsertCert.run(c);
}

const stmtGetCertsByRecipient = db.prepare<{ address: string }>(`
  SELECT * FROM certificates WHERE recipient_address = @address ORDER BY issued_at DESC
`);

export function getCertificatesByRecipient(address: string): DbCertificate[] {
  return stmtGetCertsByRecipient.all({ address }) as DbCertificate[];
}

// ── Devices ───────────────────────────────────────────────────────────────────

const stmtInsertDevice = db.prepare<Omit<DbDevice, 'id' | 'registered_at'>>(`
  INSERT OR IGNORE INTO devices (device_id, name, location, device_type, device_cap_id, active)
  VALUES (@device_id, @name, @location, @device_type, @device_cap_id, @active)
`);

export function insertDevice(d: Omit<DbDevice, 'id' | 'registered_at'>): void {
  stmtInsertDevice.run(d);
}

const stmtUpdateDeviceCap = db.prepare<{ device_id: string; cap_id: string }>(`
  UPDATE devices SET device_cap_id = @cap_id WHERE device_id = @device_id
`);

export function updateDeviceCapId(deviceId: string, capId: string): void {
  stmtUpdateDeviceCap.run({ device_id: deviceId, cap_id: capId });
}

const stmtGetDevices = db.prepare(`
  SELECT * FROM devices WHERE active = 1 ORDER BY registered_at ASC
`);

export function getDevices(): DbDevice[] {
  return stmtGetDevices.all() as DbDevice[];
}

const stmtGetDeviceById = db.prepare<{ device_id: string }>(`
  SELECT * FROM devices WHERE device_id = @device_id
`);

export function getDeviceById(deviceId: string): DbDevice | undefined {
  return stmtGetDeviceById.get({ device_id: deviceId }) as DbDevice | undefined;
}

// ── Notarizations ─────────────────────────────────────────────────────────────

const stmtInsertNotarization = db.prepare<Omit<DbNotarization, 'id'>>(`
  INSERT OR IGNORE INTO notarizations
    (batch_hash, description, object_id, tx_digest, anchored_at, gas_station)
  VALUES
    (@batch_hash, @description, @object_id, @tx_digest, @anchored_at, @gas_station)
`);

export function insertNotarization(n: Omit<DbNotarization, 'id'>): void {
  stmtInsertNotarization.run(n);
}

const stmtGetNotarizations = db.prepare<{ limit: number }>(`
  SELECT * FROM notarizations ORDER BY anchored_at DESC LIMIT @limit
`);

export function getNotarizations(limit: number = 50): DbNotarization[] {
  return stmtGetNotarizations.all({ limit }) as DbNotarization[];
}

const stmtGetNotarizationByHash = db.prepare<{ hash: string }>(`
  SELECT * FROM notarizations WHERE batch_hash = @hash
`);

export function getNotarizationByHash(hash: string): DbNotarization | undefined {
  return stmtGetNotarizationByHash.get({ hash }) as DbNotarization | undefined;
}
