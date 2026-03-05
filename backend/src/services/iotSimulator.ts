import { EventEmitter } from 'events';
import crypto from 'crypto';

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
  baseFlowRate: number;  // Litri/ora base
  variance: number;      // Variazione percentuale
}

export class IoTSimulator extends EventEmitter {
  private devices: Device[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private readings: Map<string, WaterReading[]> = new Map();

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
        baseFlowRate: 500,  // 500 L/h
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

    // Inizializza storage per ogni device
    this.devices.forEach(d => this.readings.set(d.id, []));
  }

  public start(intervalMs: number = 5000): void {
    if (this.intervalId) return;

    console.log(`🚿 IoT Simulator started - generating readings every ${intervalMs}ms`);

    this.intervalId = setInterval(() => {
      this.devices.forEach(device => {
        const reading = this.generateReading(device);
        this.readings.get(device.id)?.push(reading);
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

  private generateReading(device: Device): WaterReading {
    const now = Date.now();
    
    // Simula variazione nel flusso
    const variationFactor = 1 + (Math.random() - 0.5) * 2 * device.variance;
    const flowRate = device.baseFlowRate * variationFactor;
    
    // Converti in litri per questo intervallo (assumendo 5 secondi)
    const liters = Math.round((flowRate / 3600) * 5 * 1000);  // x1000 per precisione
    
    // Genera dati grezzi realistici
    const rawData = {
      flowRate: Math.round(flowRate * 100) / 100,
      pressure: Math.round((2.5 + Math.random() * 1.5) * 100) / 100,  // 2.5-4 bar
      temperature: Math.round((15 + Math.random() * 10) * 100) / 100  // 15-25°C
    };

    // Genera hash dei dati per integrità
    const dataString = JSON.stringify({ deviceId: device.id, liters, timestamp: now, rawData });
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');

    return {
      deviceId: device.id,
      liters,
      timestamp: now,
      rawData,
      hash
    };
  }

  public getDevices(): Device[] {
    return this.devices;
  }

  public getDeviceReadings(deviceId: string, limit: number = 100): WaterReading[] {
    const readings = this.readings.get(deviceId) || [];
    return readings.slice(-limit);
  }

  public getAllReadings(limit: number = 100): WaterReading[] {
    const allReadings: WaterReading[] = [];
    this.readings.forEach(deviceReadings => {
      allReadings.push(...deviceReadings.slice(-limit));
    });
    return allReadings.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  public getStats(): { totalReadings: number; totalLiters: number; byDevice: Record<string, { readings: number; liters: number }> } {
    let totalReadings = 0;
    let totalLiters = 0;
    const byDevice: Record<string, { readings: number; liters: number }> = {};

    this.readings.forEach((readings, deviceId) => {
      const deviceLiters = readings.reduce((sum, r) => sum + r.liters, 0);
      byDevice[deviceId] = {
        readings: readings.length,
        liters: deviceLiters
      };
      totalReadings += readings.length;
      totalLiters += deviceLiters;
    });

    return { totalReadings, totalLiters, byDevice };
  }
}

export const iotSimulator = new IoTSimulator();
