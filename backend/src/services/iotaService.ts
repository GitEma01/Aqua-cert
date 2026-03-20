import { IotaClient } from '@iota/iota-sdk/client';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import { Transaction } from '@iota/iota-sdk/transactions';
import dotenv from 'dotenv';
import { gasStationService } from './gasStationService';

dotenv.config();

interface TransactionResult {
  success: boolean;
  digest?: string;
  objectId?: string;
  footprintClass?: string;
  error?: string;
}

export interface CertificateObject {
  objectId: string;
  certificateNumber: string;
  companyName: string;
  periodStart: number;
  periodEnd: number;
  totalLiters: number;
  totalReadings: number;
  footprintClass: string;
  certifier: string;
  issuedAt: number;
  registryId: string;
}

class IOTAService {
  private client: IotaClient;
  private keypair: Ed25519Keypair;

  constructor() {
    const networkUrl = process.env.IOTA_NETWORK_URL || 'https://api.testnet.iota.cafe';
    this.client = new IotaClient({ url: networkUrl });
    
    // Inizializza keypair dalla private key
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY non configurata nel file .env');
    }
    this.keypair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey.replace(/^0x/, ''), 'hex'));
  }

  public async getAddress(): Promise<string> {
    return this.keypair.getPublicKey().toIotaAddress();
  }

  /** Expose client for tx.build() in server-side sponsored flows */
  public getClient(): IotaClient { return this.client; }

  public async getBalance(): Promise<bigint> {
    const address = await this.getAddress();
    const balance = await this.client.getBalance({ owner: address });
    return BigInt(balance.totalBalance);
  }

  /**
   * Fetches gas coins for the backend wallet sorted by balance descending.
   * Large-balance coins are likely fresh faucet coins; locked ones tend to be older.
   */
  private async getGasCoins() {
    const address = await this.getAddress();
    const resp = await this.client.getCoins({ owner: address });
    return resp.data.sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)));
  }

  /**
   * Executes a transaction built by the provided factory function.
   * Accepts a factory so each retry gets a completely fresh Transaction object
   * — avoids stale build state when setGasPayment is called multiple times.
   *
   * Uses IOTA Gas Station when configured, otherwise iterates through
   * available gas coins to skip any locked by stuck testnet transactions.
   */
  private async executeTransaction(
    buildTx: () => Transaction,
    options = { showEffects: true, showEvents: true, showObjectChanges: true }
  ) {
    if (gasStationService.isAvailable()) {
      try {
        const tx = buildTx();
        const senderAddress = await this.getAddress();
        const reservation = await gasStationService.reserveGas();

        tx.setSender(senderAddress);
        tx.setGasOwner(reservation.sponsor_address);
        tx.setGasPayment(reservation.gas_coins as any);
        tx.setGasBudget(50_000_000);

        const txBytes = await tx.build({ client: this.client });
        const txBytesBase64 = Buffer.from(txBytes).toString('base64');
        const { signature } = await this.keypair.signTransaction(txBytes);

        const { digest } = await gasStationService.executeTx(
          reservation.reservation_id,
          txBytesBase64,
          signature
        );

        console.log(`⛽ Gas-sponsored tx: ${digest}`);
        return this.client.getTransactionBlock({ digest, options });
      } catch (err) {
        console.warn('⚠️  Gas station unavailable, falling back to direct signing:', (err as Error).message);
      }
    }

    // Try each gas coin with a fresh Transaction per attempt.
    // This avoids stale internal build state from previous failed attempts.
    const coins = await this.getGasCoins();
    let lastError: Error = new Error('No gas coins available in wallet');

    for (const coin of coins) {
      const tx = buildTx(); // fresh builder every time
      tx.setGasPayment([{
        objectId: coin.coinObjectId,
        version: coin.version,
        digest: coin.digest
      }]);

      try {
        const result = await this.client.signAndExecuteTransaction({
          transaction: tx,
          signer: this.keypair,
          options
        });
        return result;
      } catch (err: any) {
        lastError = err;
        const msg: string = err?.message ?? String(err);
        if (msg.includes('reserved for another transaction') || err?.code === -32002) {
          console.warn(`⚠️  Gas coin ${coin.coinObjectId} locked, trying next...`);
          continue;
        }
        throw err; // non-lock error — propagate immediately
      }
    }

    throw lastError;
  }

  /**
   * Registra una lettura idrica su IOTA
   */
  public async recordWaterReading(
    deviceCapId: string,
    registryId: string,
    liters: number,
    dataHash: string
  ): Promise<TransactionResult> {
    try {
      const packageId = process.env.PACKAGE_ID;
      if (!packageId) throw new Error('PACKAGE_ID non configurato');

      const result = await this.executeTransaction(() => {
        const tx = new Transaction();
        tx.setGasBudget(10000000);
        tx.moveCall({
          target: `${packageId}::water_registry::record_reading`,
          arguments: [
            tx.object(deviceCapId),
            tx.object(registryId),
            tx.pure.u64(liters),
            tx.pure.string(dataHash),
            tx.object('0x6')
          ],
        });
        return tx;
      });

      console.log(`✅ Reading recorded on IOTA: ${result.digest}`);
      
      // Estrai l'ID della lettura creata
      const createdObject = result.objectChanges?.find(
        (obj: any) => obj.type === 'created' && obj.objectType.includes('WaterReading')
      );

      return {
        success: true,
        digest: result.digest,
        objectId: createdObject ? (createdObject as any).objectId : undefined
      };
    } catch (error: any) {
      console.error('❌ Error recording reading:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Emette un certificato Water Footprint
   */
  public async issueCertificate(
    certifierCapId: string,
    registryId: string,
    certificateNumber: string,
    companyName: string,
    periodStart: number,
    periodEnd: number,
    imageUrl: string,
    recipient: string
  ): Promise<TransactionResult> {
    try {
      const packageId = process.env.PACKAGE_ID;
      if (!packageId) throw new Error('PACKAGE_ID non configurato');

      const result = await this.executeTransaction(() => {
        const tx = new Transaction();
        tx.setGasBudget(20000000);
        tx.moveCall({
          target: `${packageId}::water_certificate::issue_certificate`,
          arguments: [
            tx.object(certifierCapId),
            tx.object(registryId),
            tx.pure.string(certificateNumber),
            tx.pure.string(companyName),
            tx.pure.u64(periodStart),
            tx.pure.u64(periodEnd),
            tx.pure.string(imageUrl),
            tx.object('0x6'),
            tx.pure.address(recipient)
          ],
        });
        return tx;
      });

      console.log(`✅ Certificate issued: ${result.digest}`);

      const createdObject = result.objectChanges?.find(
        (obj: any) => obj.type === 'created' && obj.objectType.includes('WaterCertificate')
      );

      const certEvent = result.events?.find((e: any) => e.type.includes('CertificateIssued'));
      const footprintClass = (certEvent?.parsedJson as any)?.water_footprint_class ?? undefined;

      return {
        success: true,
        digest: result.digest,
        objectId: createdObject ? (createdObject as any).objectId : undefined,
        footprintClass
      };
    } catch (error: any) {
      console.error('❌ Error issuing certificate:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Minta Water Token
   */
  public async mintWaterTokens(
    treasuryCapId: string,
    tokenInfoId: string,
    amount: number,
    recipient: string,
    reason: string
  ): Promise<TransactionResult> {
    try {
      const packageId = process.env.PACKAGE_ID;
      if (!packageId) throw new Error('PACKAGE_ID non configurato');

      const result = await this.executeTransaction(() => {
        const tx = new Transaction();
        tx.setGasBudget(10000000);
        tx.moveCall({
          target: `${packageId}::water_token::mint`,
          arguments: [
            tx.object(treasuryCapId),
            tx.object(tokenInfoId),
            tx.pure.u64(amount),
            tx.pure.address(recipient),
            tx.pure.string(reason)
          ],
        });
        return tx;
      });

      console.log(`✅ Tokens minted: ${result.digest}`);

      return {
        success: true,
        digest: result.digest
      };
    } catch (error: any) {
      console.error('❌ Error minting tokens:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Query eventi recenti
   */
  public async queryRecentEvents(eventType: string, limit: number = 50): Promise<any[]> {
    try {
      const packageId = process.env.PACKAGE_ID;
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${packageId}::${eventType}`
        },
        limit,
        order: 'descending'
      });
      return events.data;
    } catch (error) {
      console.error('Error querying events:', error);
      return [];
    }
  }

  /**
   * Registra un nuovo dispositivo IoT on-chain
   */
  public async registerDevice(
    adminCapId: string,
    registryId: string,
    deviceId: string,
    location: string,
    deviceType: string
  ): Promise<TransactionResult> {
    try {
      const packageId = process.env.PACKAGE_ID;
      if (!packageId) throw new Error('PACKAGE_ID non configurato');

      const result = await this.executeTransaction(() => {
        const tx = new Transaction();
        tx.setGasBudget(10000000);
        tx.moveCall({
          target: `${packageId}::water_registry::register_device`,
          arguments: [
            tx.object(adminCapId),
            tx.object(registryId),
            tx.pure.string(deviceId),
            tx.pure.string(location),
            tx.pure.string(deviceType)
          ]
        });
        return tx;
      });

      console.log(`✅ Device registered on IOTA: ${result.digest}`);

      const deviceCapObj = result.objectChanges?.find(
        (obj: any) => obj.type === 'created' && obj.objectType.includes('DeviceCap')
      );

      return {
        success: true,
        digest: result.digest,
        objectId: deviceCapObj ? (deviceCapObj as any).objectId : undefined
      };
    } catch (error: any) {
      console.error('❌ Error registering device:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ottieni i certificati NFT posseduti da un indirizzo
   */
  public async getCertificatesByOwner(ownerAddress: string): Promise<CertificateObject[]> {
    try {
      const packageId = process.env.PACKAGE_ID;
      if (!packageId) throw new Error('PACKAGE_ID non configurato');

      const result = await this.client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${packageId}::water_certificate::WaterCertificate`
        },
        options: { showContent: true }
      });

      return result.data
        .filter(item => item.data?.content?.dataType === 'moveObject')
        .map(item => {
          const fields = (item.data!.content as any).fields;
          return {
            objectId: item.data!.objectId,
            certificateNumber: fields.certificate_number ?? '',
            companyName: fields.company_name ?? '',
            periodStart: Number(fields.period_start ?? 0),
            periodEnd: Number(fields.period_end ?? 0),
            totalLiters: Number(fields.total_liters ?? 0),
            totalReadings: Number(fields.total_readings ?? 0),
            footprintClass: fields.water_footprint_class ?? '?',
            certifier: fields.certifier ?? '',
            issuedAt: Number(fields.issued_at ?? 0),
            registryId: fields.registry_id?.id ?? ''
          };
        });
    } catch (error: any) {
      console.error('❌ Error fetching certificates:', error);
      return [];
    }
  }

  /**
   * Ottieni oggetto per ID
   */
  public async getObject(objectId: string): Promise<any> {
    try {
      const result = await this.client.getObject({
        id: objectId,
        options: {
          showContent: true,
          showOwner: true
        }
      });
      return result.data;
    } catch (error) {
      console.error('Error getting object:', error);
      return null;
    }
  }
}

export const iotaService = new IOTAService();
