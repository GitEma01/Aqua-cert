import { EventEmitter } from 'events';
import crypto from 'crypto';
import { insertReading, insertDevice, getReadings, getDeviceReadings, getReadingStats } from '../database';

export interface WaterReading {
  deviceId: string;
  liters: number;
  timestamp: number;
  rawData: {
    flowRate: number;
    pressure: number;
    temperature: number;
  };
  hash: string;
}

export interface Device {
  id: string;
  name: string;
  location: string;
  type: 'irrigation' | 'industrial' | 'datacenter';
  baseFlowRate: number;
  variance: number;
}

export class IoTSimulator extends EventEmitter {
  private devices: Device[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeDevices();
  }

  private initializeDevices(): void {
    this.devices = [
      {
        id: 'SENSOR-IRR-001',
        name: 'Campo Irrigazione Nord',
        location: 'Azienda Agricola Verdi - Settore A',
        type: 'irrigation',
        baseFlowRate: 500,
        variance: 0.3
      },
      {
        id: 'SENSOR-IRR-002',
        name: 'Campo Irrigazione Sud',
        location: 'Azienda Agricola Verdi - Settore B',
        type: 'irrigation',
        baseFlowRate: 450,
        variance: 0.25
      },
      {
        id: 'SENSOR-IND-001',
        name: 'Linea Produzione Tessile',
        location: 'Stabilimento Milano',
        type: 'industrial',
        baseFlowRate: 2000,
        variance: 0.4
      },
      {
        id: 'SENSOR-DC-001',
        name: 'Sistema Raffreddamento',
        location: 'Data Center Roma',
        type: 'datacenter',
        baseFlowRate: 800,
        variance: 0.15
      }
    ];

    // Seed initial devices into SQLite (idempotent)
    for (const device of this.devices) {
      insertDevice({
        device_id: device.id,
        name: device.name,
        location: device.location,
        device_type: device.type,
        device_cap_id: null,
        active: 1
      });
    }
  }

  public start(intervalMs: number = 5000): void {
    if (this.intervalId) return;

    console.log(`🚿 IoT Simulator started - generating readings every ${intervalMs}ms`);

    this.intervalId = setInterval(() => {
      this.devices.forEach(device => {
        const reading = this.generateReading(device);
        // Persist to SQLite immediately
        insertReading({
          device_id: reading.deviceId,
          liters: reading.liters,
          timestamp: reading.timestamp,
          flow_rate: reading.rawData.flowRate,
          pressure: reading.rawData.pressure,
          temperature: reading.rawData.temperature,
          hash: reading.hash,
          on_chain: 0
        });
        this.emit('reading', reading);
      });
    }, intervalMs);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 IoT Simulator stopped');
    }
  }

  public addDevice(device: Device): void {
    if (this.devices.find(d => d.id === device.id)) return;
    this.devices.push(device);
    insertDevice({
      device_id: device.id,
      name: device.name,
      location: device.location,
      device_type: device.type,
      device_cap_id: null,
      active: 1
    });
  }

  private generateReading(device: Device): WaterReading {
    const now = Date.now();
    const variationFactor = 1 + (Math.random() - 0.5) * 2 * device.variance;
    const flowRate = device.baseFlowRate * variationFactor;
    const liters = Math.round((flowRate / 3600) * 5 * 1000);

    const rawData = {
      flowRate: Math.round(flowRate * 100) / 100,
      pressure: Math.round((2.5 + Math.random() * 1.5) * 100) / 100,
      temperature: Math.round((15 + Math.random() * 10) * 100) / 100
    };

    const dataString = JSON.stringify({ deviceId: device.id, liters, timestamp: now, rawData });
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');

    return { deviceId: device.id, liters, timestamp: now, rawData, hash };
  }

  public getDevices(): Device[] {
    return this.devices;
  }

  public getDeviceReadings(deviceId: string, limit: number = 100): WaterReading[] {
    return getDeviceReadings(deviceId, limit).map(r => ({
      deviceId: r.device_id,
      liters: r.liters,
      timestamp: r.timestamp,
      rawData: { flowRate: r.flow_rate, pressure: r.pressure, temperature: r.temperature },
      hash: r.hash
    }));
  }

  public getAllReadings(limit: number = 100): WaterReading[] {
    return getReadings(limit).map(r => ({
      deviceId: r.device_id,
      liters: r.liters,
      timestamp: r.timestamp,
      rawData: { flowRate: r.flow_rate, pressure: r.pressure, temperature: r.temperature },
      hash: r.hash
    }));
  }

  public getStats(): { totalReadings: number; totalLiters: number; byDevice: Record<string, { readings: number; liters: number }> } {
    return getReadingStats();
  }
}

export const iotSimulator = new IoTSimulator();
