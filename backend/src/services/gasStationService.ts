import dotenv from 'dotenv';
dotenv.config();

interface GasReservation {
  sponsor_address: string;
  reservation_id: string;
  gas_coins: Array<{ objectId: string; version: number; digest: string }>;
}

interface ExecuteResult {
  digest: string;
  effects?: any;
}

class GasStationService {
  private get url(): string | undefined { return process.env.GAS_STATION_URL; }
  private get token(): string | undefined { return process.env.GAS_STATION_TOKEN; }

  isAvailable(): boolean { return !!this.url; }

  private authHeader(): Record<string, string> {
    return this.token
      ? { Authorization: `Bearer ${this.token}` }
      : {};
  }

  async reserveGas(gasBudget = 50_000_000, durationSecs = 120): Promise<GasReservation> {
    if (!this.url) throw new Error('GAS_STATION_URL not configured');

    const res = await fetch(`${this.url}/v1/reserve_gas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeader() },
      body: JSON.stringify({ gas_budget: gasBudget, reserve_duration_secs: durationSecs })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gas station reserve_gas failed (${res.status}): ${body}`);
    }

    const data = await res.json() as any;
    // Response: { result: { sponsor_address, reservation_id, gas_coins } }
    // or directly: { sponsor_address, reservation_id, gas_coins }
    return data.result ?? data;
  }

  async executeTx(
    reservationId: string,
    txBytesBase64: string,
    userSig: string
  ): Promise<ExecuteResult> {
    if (!this.url) throw new Error('GAS_STATION_URL not configured');

    const res = await fetch(`${this.url}/v1/execute_tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeader() },
      body: JSON.stringify({
        reservation_id: reservationId,
        tx_bytes: txBytesBase64,
        user_sig: userSig
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gas station execute_tx failed (${res.status}): ${body}`);
    }

    const data = await res.json() as any;
    // Normalise: extract digest from wherever the gas station puts it
    const effects = data.effects ?? data.result?.effects ?? data;
    const digest = effects.transactionDigest ?? data.digest ?? data.result?.digest;
    return { digest, effects };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.url) return false;
    try {
      const res = await fetch(this.url, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const gasStationService = new GasStationService();
